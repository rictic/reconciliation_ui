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
    var base = 'https://www.googleapis.com';
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
    vars = new Set();

    constructor(public id:string, public graph:string) {
      this.base_url = getUrlForGraph(graph) + "/jobs/" + id;
    }

    get(callback:(resp:SuperFreeq.JobStatus)=>any) {
      doRequest(this.base_url, {}, callback, 'GET');
    }

    start(onStarted=()=>null) {
      var request : ChangeStatusRequest = {
        "jobStatus": "running"
      };

      doRequest(this.base_url  + "/status",
                $.param(request), onStarted);
    }

    load(commands: TripleLoadCommand[], callback:(LoadTriplesResponse)=>any) {

      var trackValue = (s:string) => {
        if (s && /^\$.*\d+$/.test(s)) {
          this.vars.add(s);
        }
      }

      politeEach(commands, (i, command:TripleLoadCommand) => {
        // Track the variables we're uploading to this job, so that we can
        // later ask for them back.
        trackValue(command.triple.sub);
        trackValue(command.triple.pred);
        trackValue(command.triple.obj);
        if (!command.cvt_triples) {
          return;
        }
        for (var i = 0; i < command.cvt_triples.length; i++) {
          var cvt : CVTTriple = command.cvt_triples[i];
          trackValue(cvt.pred);
          trackValue(cvt.obj);
        }
      }, () => {
        var BATCH_SIZE = 300;
        var loadSome = () => {
          if (commands.length === 0) {
            callback({});
            return;
          }
          var batch = [];
          for (var i = 0; commands.length > 0 && i < BATCH_SIZE; i++) {
            batch.push(commands.shift());
          }
          var request = {
            'load_triples': batch
          }
          doRequest(this.base_url + '/tasks', request, loadSome);
        }
        loadSome();
      })
    }

    getIdMapping(callback:(Object)=>void) {
      var var_ids = this.vars.getAll();
      var result = {};
      var BATCH_SIZE = 100;

      var getSome = () => {
        if (var_ids.length === 0) {
          callback(result);
          return;
        }
        var batch = [];
        for (var i = 0; var_ids.length > 0 && i < BATCH_SIZE; i++) {
          batch.push(var_ids.shift());
        }
        var vars = batch.join(',').replace(/\$/g,'');
        doRequest(this.base_url + '/mids', 'vars=' + vars, (v) =>{
          $.extend(result, v);
          addTimeout(5 * 1000, getSome());
        } , 'GET')
      }
      getSome();
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

  function doRequest(url:string, params:any, onResponse?, method='POST') {
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
      $.ajax({
        url: url,
        dataType:'json',
        contentType: contentType,
        type: method,
        data: data,
        success: onResponse,
        retryLimit: 20,
        tryCount: 0,
        timeouts: [10, 10, 20, 30, 50, 80], // back-off by tryCount, in seconds
        headers: {
          'Authorization': 'Bearer ' + gapi.auth.getToken().access_token
        },
        error: function(xhr, textStatus) {
          if ($.inArray(textStatus, ['timeout', 'abort', 'error']) > -1) {
            this.tryCount++;
            if (this.tryCount <= this.retryLimit) {
              var retryIndex = Math.min(this.tryCount - 1, this.timeouts.length - 1);
              var retryIn = this.timeouts[retryIndex] * 1000;
              console.log('RPC failed, retrying in', retryIn / 1000, 'seconds');
              setTimeout(() => { $.ajax(this); }, retryIn);
            } else {
              $('#freeqErrorDialog')
                .text('RPC failed after ' + this.tryCount + ' requests');
              $('#freeqErrorDialog').dialog({
                modal: true,
                resizable: false
              });
            }
          }
        }
      });
    }

    // Refreshes our bearer token or forces a login otherwise.
    isAuthorized(()=> authorize(_doRequest), _doRequest);
  }
}
