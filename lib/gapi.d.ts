interface GapiClientRequestParams {
  path: string;
  params: Object;
}

interface GapiClientRequest {
  execute(callBack:(o:Object)=>void):void;
}

interface GapiHttpBatch {
  add(req:GapiClientRequest, opt?:Object):void;
  execute():void;
}

interface GapiClient {
  setApiKey(key:string):void;
  request(p:GapiClientRequestParams):GapiClientRequest;
  load(api:string, version:string, onSetup:()=>void):void;
  register(method:Object):void;
  newHttpBatch():GapiHttpBatch;
}

declare module gapi {
  export var client : GapiClient;
    //export request();
    //declare request(p:GapiClientRequest):GapiClientQuery;

  export var auth : {
    getToken():{
      access_token: string;
      expires_in: string;
      state: string;
      token_type: string;
    };
    authorize(params:Object, handler:(o:Object)=>any):void;
  };
}
