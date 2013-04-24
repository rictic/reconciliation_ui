interface GapiClientRequestParams {
  path: string;
  params: Object;
}

interface GapiClientRequest {
  execute(callBack:(Object)=>void):void;
}

interface GapiClient {
  setApiKey(key:string);
  request(p:GapiClientRequestParams):GapiClientRequest;
  load(api:string, version:string, onSetup:()=>void);
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
    authorize(params:Object, handler:(Object)=>any);
  };
}
