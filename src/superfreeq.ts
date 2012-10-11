module SuperFreeq {
  interface Triple {
    triple: {
      sub: string;
      pred: string;
      obj_type: string;
      obj: string;
    };
  };

  interface CreateJobRequest {
    name: string;
  }
  interface CreateJobResponse {
    id: string;
  }

  // Returns the id of the new job.
  export function createJob(name:string):string {
    var request : CreateJobRequest = {
      name:name
    };

    var response = <CreateJobResponse> doRequest("jobs", request);
    return response.id;
  }

  var client_id = "738879533750.apps.googleusercontent.com";
  var scopes = "https://www.googleapis.com/auth/freebase";

  export function authorize(onAuthorized) {
    var params = {
      client_id: client_id,
      scope: scopes,
      immediate: false
    };

    function handleResult(authResult) {
      if (authResult && !authResult.error) {
        onAuthorized();
      } else {
        params.immediate = true;
        gapi.auth.authorize(params, handleResult);
      }
    }

    gapi.auth.authorize(params, handleResult);
  }

  function doRequest(path:string, params:Object) {
    return {};
  }
}
