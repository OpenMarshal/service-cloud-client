import * as request from 'request'
import * as URL from 'url'

export function parseRemote(remote : ServiceCloudRemote | string) : ServiceCloudRemote
{
    if(remote.constructor !== String)
        return remote as ServiceCloudRemote;

    const url = URL.parse(remote as string);
    return {
        address: url.hostname,
        port: url.port ? parseInt(url.port) : undefined,
        protocol: url.protocol,
        path: url.path
    };
}

export interface ServiceCloudRemote
{
    address : string
    port ?: number
    protocol ?: string
    path ?: string
}

export type ServiceCloudRemoteUrl = ServiceCloudRemote | string;

export interface ServiceCloudServiceInformation
{
    name : string
    actions : string[]
    systemActions : string[]
}

export interface ServiceCloudServiceInformationRequest
{
    type : 'info'
}

export interface ServiceCloudServiceRequest
{
    actionName : string
    type : string
}
export interface ServiceCloudServiceCall extends ServiceCloudServiceRequest
{
    type : 'execute'
    data : any
}
export interface ServiceCloudServicePing extends ServiceCloudServiceRequest
{
    serviceName : string
    type : 'ping'
    ttl : number
}
export interface ServiceCloudServicePingResponse
{
    found ?: boolean
    serviceName ?: string
    actionName ?: string
    remote ?: ServiceCloudRemote
}

export interface ServiceCloudServiceCallResponse
{
    success : boolean
    error ?: string
    data ?: any
}

export class ServiceCloudClient
{
    constructor(public serviceName : string, public remote : ServiceCloudRemoteUrl)
    { }
    
    public listActions(callback : (e : Error, actions : string[]) => void) : void
    {
        return this._listActions(callback);
    }
    
    public information(callback : (e : Error, info : ServiceCloudServiceInformation) => void) : void
    {
        return this._information(callback);
    }
    
    public expandActions(callback : (e : Error) => void) : void
    {
        return this._expandActions(callback);
    }
    
    public call<I, O>(actionName : string, data : I, callback : (e : Error, result : O) => void) : void
    public call(actionName : string, data : any, callback : (e : Error, result : any) => void) : void
    public call(actionName : string, data : any, callback : (e : Error, result : any) => void) : void
    {
        return this._call(actionName, data, callback);
    }

    public resolve(actionName : string, callback : (e : Error, information : ServiceCloudServicePingResponse) => void) : void
    {
        ServiceCloudClient.resolve(this.serviceName, actionName, this.remote, callback);
    }

    protected _expandActions(callback : (e ?: Error) => void) : void
    {
        this._listActions((e, actions) => {
            if(e)
                return callback(e);

            actions.forEach((action) => this[action] = (data : any, callback : (e : Error, result : any) => void) => {
                this._call(action, data, callback);
            });

            callback();
        });
    }

    protected _listActions(callback : (e : Error, actions ?: string[]) => void) : void
    {
        this._information((e, info) => {
            if(e)
                return callback(e);

            return callback(undefined, info.actions);
        })
    }
    
    protected _information(callback : (e : Error, info ?: ServiceCloudServiceInformation) => void) : void
    {
        ServiceCloudClient.resolve(this.serviceName, undefined, this.remote, (e, final) => {
            if(e)
                return callback(e);
            
            ServiceCloudClient.request<ServiceCloudServiceInformationRequest, ServiceCloudServiceInformation>(final.serviceName, final.remote, {
                type: 'info'
            }, callback);
        })
    }

    protected _call<I, O>(actionName : string, data : I, callback : (e : Error, result : O) => void) : void
    protected _call(actionName : string, data : any, callback : (e : Error, result : any) => void) : void
    protected _call(actionName : string, data : any, callback : (e : Error, result : any) => void) : void
    {
        return ServiceCloudClient.call(this.serviceName, actionName, this.remote, data, callback);
    }
    
    public static getURLFromRemote(serviceName : string, remote : ServiceCloudRemoteUrl) : string
    {
        while(serviceName.indexOf('/') === 0)
            serviceName = serviceName.substr(1);

        const rRemote = parseRemote(remote);

        let path = rRemote.path ? rRemote.path : '';
        while(path.indexOf('/') === 0)
            path = path.substr(1);
        while(path.length > 0 && path.lastIndexOf('/') === path.length - 1)
            path = path.substr(0, path.length - 1);
        if(path.length > 0)
            path = '/' + path;

        return (rRemote.protocol ? rRemote.protocol : 'http:') + '//' + rRemote.address + ':' + (rRemote.port ? rRemote.port : 80) + path + '/' + serviceName;
    }

    public static resolve(serviceName : string, actionName : string, remote : ServiceCloudRemoteUrl, callback : (e : Error, final ?: ServiceCloudServicePingResponse) => void) : void
    public static resolve(serviceName : string, actionName : string, remote : ServiceCloudRemoteUrl, ttl : number, callback : (e : Error, final ?: ServiceCloudServicePingResponse) => void) : void
    public static resolve(serviceName : string, actionName : string, remote : ServiceCloudRemoteUrl, _ttl : number | ((e : Error, final ?: ServiceCloudServicePingResponse) => void), _callback ?: (e : Error, final ?: ServiceCloudServicePingResponse) => void) : void
    {
        const ttl = _callback ? _ttl as number : 100;
        const callback = _callback ? _callback : _ttl as (e : Error, final ?: ServiceCloudServicePingResponse) => void;

        if(ttl <= 0)
            return callback(new Error('TTL expired'));

        const isSame = function(value1, value2, defaultValue) {
            return value1 === value2 || value1 === defaultValue && value2 === undefined || value1 === undefined && value2 === defaultValue;
        };

        ServiceCloudClient.request<ServiceCloudServicePing, ServiceCloudServicePingResponse>('', remote, {
            serviceName: serviceName,
            actionName: actionName,
            ttl: ttl - 1,
            type: 'ping'
        }, (e, result) => {
            if(e)
                return callback(e);
            
            const rRemote = parseRemote(remote);

            if(!result.found && (
                result.actionName !== actionName
                || result.serviceName !== serviceName
                || result.remote.address !== rRemote.address
                || !isSame(result.remote.port, rRemote.port, 80)
                || !isSame(result.remote.protocol, rRemote.protocol, 'http:')
                || !isSame(result.remote.path, rRemote.path, '')))
            {
                return this.resolve(result.serviceName, result.actionName, result.remote, callback);
            }
            
            callback(undefined, {
                serviceName: serviceName,
                actionName: actionName,
                remote: rRemote
            });
        });
    }

    public static request<I, O>(serviceName : string, remote : ServiceCloudRemoteUrl, dataToSend : I, callback : (e : Error, result ?: O) => void) : void
    public static request(serviceName : string, remote : ServiceCloudRemoteUrl, dataToSend : any, callback : (e : Error, result ?: any) => void) : void
    public static request(serviceName : string, remote : ServiceCloudRemoteUrl, dataToSend : any, callback : (e : Error, result ?: any) => void) : void
    {
        request({
            url: ServiceCloudClient.getURLFromRemote(serviceName, remote),
            method: 'POST',
            body: dataToSend,
            json: true
        }, (e, res, body) => {
            if(e)
                return callback(e);
            if(res.statusCode !== 200)
                return  callback(new Error('Error ' + res.statusCode + ' - ' + res.statusMessage));
            
            if(!body.success)
                return callback(new Error(body.error ? body.error : 'Unknown error'));
            return callback(undefined, body.data);
        });
    }

    public static call<I, O>(serviceName : string, actionName : string, remote : ServiceCloudRemoteUrl, data : I, callback : (e : Error, result ?: O) => void) : void
    public static call(serviceName : string, actionName : string, remote : ServiceCloudRemoteUrl, data : any, callback : (e : Error, result ?: any) => void) : void
    public static call(serviceName : string, actionName : string, remote : ServiceCloudRemoteUrl, data : any, callback : (e : Error, result ?: any) => void) : void
    {
        ServiceCloudClient.resolve(serviceName, actionName, remote, (e, final) => {
            if(e)
                return callback(e);

            ServiceCloudClient.request<ServiceCloudServiceCall, any>(serviceName, final.remote, {
                actionName: final.actionName,
                type: 'execute',
                data
            }, callback);
        })
    }
}
