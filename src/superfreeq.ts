module SuperFreeq {
  export interface Triple {
    sub: string;
    pred: string;
    obj_type?: string;
    obj?: string;

    // provenance?: Provenance;
    // interface Provenance {
    //   restrictions: Restriction[];
    // }
    // enum Restriction {
    //   ProvenanceREQUIRES_CITATION
    // }
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

  interface CreateTasksRequest {
    load_triples?: TripleLoadCommand[];
    delete_triples?: TripleDeleteCommand[];
    update_triples?: TripleUpdateCommand[];
  }

  export interface CVTTriple {
    obj: string;
    pred: string;
    text_lang?: string;
    obj_type?: string;
  }

  export interface Action {
    triple: Triple;
    assert_ids: boolean;
    cvt_triples?: CVTTriple[];

    // If we're creating or updating, don't assert something that's been
    // deleted before. Not sure what this means for deletes.
    no_reassert?: boolean
  }
  export interface TripleLoadCommand extends Action { }
  export interface TripleDeleteCommand extends Action { }
  export interface TripleUpdateCommand extends Action { }

  // Response from FreeQ when you ask for tasks.
  // Yes, both of them can be missing, leading to an empty response.
  interface GetTasksResponse {
    items?: TaskResponseItem[];
    nextPageToken?: PageToken;
  }

  interface TaskRequestParams {
    taskStatus: string;
    pageToken?: PageToken;
  }

  export interface TaskResponseItem {
    id: string;
    kind: string;
    status: string;
    error: string;
    creation_date: string;
    finish_date: string;
    load_triple: TripleLoadCommand;
  }

  interface PageToken {
    pretendThisIsANominalType: PageToken;
  }

  export interface IdMap {
    [newEntityId:string]: string;
  }

  export enum UploadTripleAction {
    CREATE = 0,
    UPDATE = 1,
    DELETE = 2,
  }

  // Returns the id of the new job.
  export function createJob(name:string, graph:string,
                            info_source:string):Q.Promise<Job> {
    var request : CreateJobRequest = {
      name:name,
      graph_instance: graph
    };
    if (info_source) {
      request['mdo_info'] = {
        info_source: info_source
      };
    }

    return doRequest<CreateJobResponse>(getUrlForGraph(graph) + "/jobs", request)
      .then((response) => {
        return new Job(response.id, graph);
      });
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
    vars = new PSet();

    constructor(public id:string, public graph:string) {
      this.base_url = getUrlForGraph(graph) + "/jobs/" + id;
    }

    get():Q.Promise<JobStatus> {
      return doRequest<JobStatus>(this.base_url, {}, 'GET');
    }

    start():Q.Promise<any> {
      var request : ChangeStatusRequest = {
        "jobStatus": "running"
      };

      return doRequest(this.base_url  + "/status", $.param(request));
    }

    load(commands: Action[], tripleKind:UploadTripleAction):Q.Promise<LoadTriplesResponse> {
      if (this.graph != 'sandbox') {
        // Temporary, while this feature is in test.
        tripleKind = UploadTripleAction.CREATE;
      }

      var trackValue = (s:string) => {
        if (s && /^\$.*\d+$/.test(s)) {
          this.vars.add(s);
        }
      }

      var defer = Q.defer<LoadTriplesResponse>();
      var progress = new QuickProgress(defer, commands.length);
      politeEach(commands, (_:any, command:Action) => {
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
            defer.resolve({});
            return;
          }
          var batch : Action[] = [];
          for (var i = 0; commands.length > 0 && i < BATCH_SIZE; i++) {
            batch.push(commands.shift());
          }
          var request : CreateTasksRequest  = {}
          switch(tripleKind) {
          case(UploadTripleAction.CREATE):
            batch.forEach((t) => {t.no_reassert = true});
            request.load_triples = batch;
            break;
          case(UploadTripleAction.UPDATE):
            batch.forEach((t) => {t.no_reassert = true});
            request.update_triples = batch;
            break;
          case(UploadTripleAction.DELETE):
            request.delete_triples = batch;
            break;
          default: throw new Error("unknown tripleKind:" + tripleKind);
          }
          doRequest(this.base_url + '/tasks', request).then(function() {
            progress.increment(batch.length);
            loadSome();
          });
        }
        loadSome();
      })

      return defer.promise;
    }

    getIdMapping():Q.Promise<IdMap> {
      var var_ids = this.vars.getAll();
      var result : SuperFreeq.IdMap = {};
      var BATCH_SIZE = 100;
      var defer = Q.defer<IdMap>();
      var progress = new QuickProgress(defer, var_ids.length);

      var self = this;
      var getSome = function():Q.Promise<IdMap> {
        if (var_ids.length === 0) {
          return Q(result);
        }
        var batch : string[] = [];
        for (var i = 0; var_ids.length > 0 && i < BATCH_SIZE; i++) {
          batch.push(var_ids.shift());
        }
        var vars = batch.join(',').replace(/\$/g,'');
        return doRequest<IdMap>(self.base_url + '/mids', 'vars=' + vars, 'GET').then(
          (v:any):Q.Promise<IdMap> => {
            progress.increment(batch.length);
            $.extend(result, v);
           // TODO(rictic): the <any> here should be unnecessary, need to figure
           //      out what's up.
            var d : Q.Promise<any> = Q.delay(5 * 1000).then(getSome);
            return d;
        });
      }
      getSome().then((idMap) => defer.resolve(idMap), (error) => defer.reject(error));

      return defer.promise;
    }

    getTasks(taskStatus:string,
             callback?:(tri:TaskResponseItem)=>void):Q.Promise<TaskResponseItem[]> {
      var params : TaskRequestParams = {
        taskStatus: taskStatus
      }

      var results : TaskResponseItem[] = [];

      var d = Q.defer<TaskResponseItem[]>();
      var getSome = () => {
        doRequest(this.base_url + '/tasks', $.param(params), "GET").then((v:GetTasksResponse) => {
          if (!v.items || v.items.length == 0) {
            d.resolve(results);
            return;
          }
          v.items.map(callback);
          results = results.concat(v.items);
          params.pageToken = v.nextPageToken;
          getSome();
        });
      }
      getSome();
      return d.promise;
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

  export function isAuthorized() {
    return Q.promise((resolve, reject) => {
      gapi.auth.authorize({
        client_id: client_id,
        scope: scopes,
        immediate: true
      }, (authResult:any) => {
        if (authResult && !authResult.error) {
          resolve(null);
        } else {
          reject(null);
        }
      });
    });
  }

  export function authorize():Q.Promise<any> {
    return Q.promise((resolve) => {
      gapi.auth.authorize({
        client_id: client_id,
        scope: scopes,
        immediate: false
      }, resolve);
    });
  }

  function doRequest<V>(url:string, params:any, method='POST'):Q.Promise<V> {
    console.log("starting a request to " + url);
    var contentType : string, data : string;
    if ($.type(params) === "object") {
      contentType = 'application/json';
      data = JSON.stringify(params, null, 2);
    } else { // string
      contentType = 'application/x-www-form-urlencoded';
      data = params;
    }

    function _doRequest():Q.Promise<V> {
      console.log("doing a request to " + url);
      return Q($.ajax({
        url: url,
        dataType:'json',
        contentType: contentType,
        type: method,
        data: data,
        retryLimit: 20,
        tryCount: 0,
        timeouts: [10, 10, 20, 30, 50, 80], // back-off by tryCount, in seconds
        headers: {
          'Authorization': 'Bearer ' + gapi.auth.getToken().access_token
        },
      })).then(null, errorHandler).then((result:any) => {
        return <V>(result);
      });
    }

    function errorHandler(xhr:JQueryXHR) {
      this.tryCount++;
      if (this.tryCount <= this.retryLimit) {
        var retryIndex = Math.min(this.tryCount - 1, this.timeouts.length - 1);
        var retryIn = this.timeouts[retryIndex] * 1000;
        console.log('RPC failed, retrying in', retryIn / 1000, 'seconds');
        return Q.delay(retryIn).then(()=>{
          return Q($.ajax(this))
            .then(null, errorHandler);
        });
      }

      $('#freeqErrorDialog').modal();
      throw new Error('got persistant errors from FreeQ')
    }

    // Refreshes our bearer token or forces a login otherwise.
    return isAuthorized().then(null, authorize).then(_doRequest);
  }
}
