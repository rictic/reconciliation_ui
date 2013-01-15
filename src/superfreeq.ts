module SuperFreeq {
  export interface Triple {
    sub: string;
    pred: string;
    obj_type?: string;
    obj?: string;
  };

  interface CreateJobRequest {
    name: string;
    graph_instance: string;
    mdo_info?: {
      info_source: string;
    };
  }
  interface CreateJobResponse {
    id: string;
    name: string;
  }

  export interface CVTTriple {
    obj: string;
    pred: string;
    text_lang?: string;
    obj_type?: string;
  }

  export interface TripleLoadCommand {
    triple: Triple;
    assert_ids: bool;
    cvt_triples?: CVTTriple[];
  }



  // Returns the id of the new job.
  export function createJob(name:string, graph:string,
                            info_source:string, callback) {
    var request : CreateJobRequest = {
      name:name,
      graph_instance: graph
    };
    if (info_source) {
      request['mdo_info'] = {
        info_source: info_source
      };
    }

    doRequest(getUrlForGraph(graph) + "/jobs", request,
      function(response:CreateJobResponse) {
        callback(new Job(response.id, graph));
      }
    );
  }

  function getUrlForGraph(graph:string) {
    var base = 'https://www-googleapis-staging.sandbox.google.com';
    var graphToVersion = {
      'otg': 'v1',
      'sandbox': 'v1sandbox'
    };

    if (!(graph in graphToVersion)) {
      throw new Error("Unknown graph: " + graph);
    }

    return base + "/freebase/" + graphToVersion[graph] + "/freeq";
  }

  export class Job {
    base_url: string;

    constructor(public id:string, public graph:string) {
      this.base_url = getUrlForGraph(graph) + "/jobs/" + id;
    }

    get(callback:(resp:SuperFreeq.JobStatus)=>any) {
      doRequest(this.base_url, {}, callback, 'GET');
    }

    start(onStarted?=()=>null) {
      var request : ChangeStatusRequest = {
        "jobStatus": "running"
      };

      doRequest(this.base_url  + "/status",
                $.param(request), onStarted);
    }

    load(commands: TripleLoadCommand[], callback:(LoadTriplesResponse)=>any) {
      var request : LoadTriplesRequest = {
        "load_triples": commands
      };

      doRequest(this.base_url + "/tasks", request, callback);
    }
  }


  interface LoadTriplesRequest {
    load_triples : TripleLoadCommand[];
  }

  export interface LoadTriplesResponse {

  }

  interface ChangeStatusRequest {
    jobStatus: string;
  }

  export interface JobStatus {
    id: string;
    kind: string;
    selfLink: string;
    name: string;
    graph_instance: string;
    status: string;
    creation_date: string; // ISO 8601 timestamp
    stats?: {
      num_ready: number;
      num_noop: number;
      num_cant: number;
      num_error: number;
      num_done: number;
    };
  }


  var client_id = "738879533750.apps.googleusercontent.com";
  var scopes = "https://www.googleapis.com/auth/freebase";

  export function isAuthorized(onNo, onYes) {
    function handleResult(authResult) {
      if (authResult && !authResult.error) {
        onYes();
      } else {
        onNo();
      }
    }

    gapi.auth.authorize({
      client_id: client_id,
      scope: scopes,
      immediate: true
    }, handleResult);
  }

  export function authorize(callback) {
    gapi.auth.authorize({
      client_id: client_id,
      scope: scopes,
      immediate: false
    }, callback);
  }

  function doRequest(url:string, params, onResponse?, method='POST') {
    console.log("starting a request to " + url);
    if ($.type(params) === "object") {
      var contentType = 'application/json';
      var data = JSON.stringify(params, null, 2);
    } else { // string
      var contentType = 'application/x-www-form-urlencoded';
      var data = params;
    }


    function _doRequest() {
      console.log("doing a request to " + url);
      $.ajax(url, {
        dataType:'json',
        contentType: contentType,
        type: method,
        data: data,
        success: onResponse,
        headers: {
          'Authorization': 'Bearer ' + gapi.auth.getToken().access_token
        }
      });
    }

    // Refreshes our bearer token or forces a login otherwise.
    isAuthorized(()=> authorize(_doRequest), _doRequest);
  }
}
