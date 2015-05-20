var connect = require('connect');
var http =  require('http');
var URL = require('url');

/*
 Replies with an error message to the service request
*/
function replyWithError(status,serviceResponse,reason){
	var result={'ok':false,'reason': reason};
	serviceResponse.writeHead(status,{'Content-Type': 'text/json'});
	serviceResponse.end(JSON.stringify(result));
}

/**
 * A service domain can be specified as a FQDN or a URI string. This function
 * determine the kind provided and make a HTTP URI out of it, completing values in the process
 */
function buildUrlFromDomainSpec(domainSpecOrUrlString)
{
	 var url = URL.parse(domainSpecOrUrlString);
	 
	 console.log("URL: "+JSON.stringify(url));
	 
	 if(url.protocol== null){
	 	url.protocol='http';
	 }
	 
	 if(url.hostname == null){
	 	console.log("domainSpecOrUrlString "+domainSpecOrUrlString.substring(0,4).toLowerCase());

	 	if(domainSpecOrUrlString.substring(0,4).toLowerCase() != 'www.'){
 			url.hostname='www.'+domainSpecOrUrlString;;
 		}else{
 			url.hostname = domainSpecOrUrlString;
 		}
	 	
	 }
	 
	 if(url.port == null){
	 	url.port = 80;
	 }
	 if(url.path == null){
		url.path='/';
	}
	console.log("URL: "+JSON.stringify(url));
	 
	 return url;
}

/*
	'Analyzes' HTML code retrieved and returns a URI string corresponding to the icon to be downloaded
*/
function findIconFromHtml(baseURL,contentType,body){

	var iconUrl;
	var baseUrlStr='';
	if(typeof baseUrl === 'object'){
		baseUrlStr = URL.format(baseURL);
	}else{
		baseUrlStr = baseURL;
	}
	iconUrl = URL.resolve(baseUrlStr,'favicon.ico');
	
	return iconUrl;
}

/**
 * Performs an HTTP GET on a domain or URI, handling redirects in the process
 */
var fetch = function(domainOrUri,res,onFetchComplete){

	var onUrlFetchedCb = function(baseUrl,contentType,body){};
	
	if(typeof onFetchComplete ==='function'){
		onUrlFetchedCb = onFetchComplete;
	}

	var fetchOneUrl = function(url,svcResp,domains){
		
		console.log(JSON.stringify(url));
		
		var proto = 'http';
		if(typeof url.protocol === 'string')
			proto = url.protocol.replace(':','');
		
		if(proto!='http' && proto!='https'){
			svcResp.writeHead(400,{'Content-Type': 'text/html'});
			svcResp.end('');
			return;
		}
		
		var options = {
			hostname: url.path,
			port:url.port,
			path: url.path
		};
		
		if(typeof url.port === 'number'){
			options.port = url.port
		}

		if(typeof url.hostname ==='string'){
			options.hostname = url.hostname;
		}
		
		if(typeof url.path ==='string'){
			options.path = url.path
		}
		
		console.log("Location:" +url.path);
		console.log("Options:" +JSON.stringify(options));
				
		var respHandler = function(response) {
			console.log("Status:" +response.statusCode);
			if( (response.statusCode >= 300) && (response.statusCode < 400)){
			
				domains.push(url.path);
				
				//Retrieve redirect location & issue request after some time
				console.log("Redirect to: "+response.headers['location']);
								
				if( (domains.length<5) && (domains.indexOf(response.headers['location'])== -1)){
				
					setTimeout(function(){
						var url = buildUrlFromDomainSpec(response.headers['location']);
						fetchOneUrl(url,svcResp,domains);
						},100);
				}else{
					replyWithError(500,svcResp,'Too many redirections');
				}				
			}
			else{
				
				var body = '';
				domains.length=0;
				
				response.on('data', function (chunk) {
					console.log("got %d byte(s) of data",chunk.length);
					body+=chunk;
				});

				response.on('end', function () {
					onUrlFetchedCb(url,response,body);
				});
			}
		}
		
		//TODO: make it work also with HTTPS
		var myReq = require('http').request(options,respHandler);
		myReq.on('error', function(e) {
			replyWithError(500,res,'unknown: '+e.toString());
		});
		myReq.end();
	};
	
	var locations = [''];
	var url = buildUrlFromDomainSpec(domainOrUri);
	
	fetchOneUrl(url,res,locations);
}

/**
 * The service connection handler
 * Inspects the service request looking for the service argument.
 * The service works as follows:
 *  - build an HTTP URI out of the service argument
 *  - retrieve the dat at this URI, this should be HTML...
 *  - analyzes the HTML to figure out where the icon lives
 *  - retrieves the icon and forwards it to the service client
 */
var iconCrawlerServiceHandler = function(serviceRequest,serviceResponse,next){
	var handled = false;
	
	if('/icon-crawler'!=serviceRequest.url){
		replyWithError(404,serviceResponse,'service not know');
		return;
	}
	if('POST'!=serviceRequest.method){
		replyWithError(400,serviceResponse,'method not supported');
		return;
	}
	if (!serviceRequest.body){
		replyWithError(400,serviceResponse,'invalid service request');
		return;
	}
	
	//TODO: validate body
	
	var onIconDownloaded = function(baseURL,response,body){

		//Forward icon to the service client
		if( (response.statusCode>=200) && (response.statusCode < 300)){
			serviceResponse.writeHead(200,{'Content-Type': response.headers['content-type']});
			serviceResponse.end(body);
		}else{
			replyWithError(500,serviceResponse,'failed to download icon');
		}
	};
			
	var onHtmlDownloaded = function(baseURL,response,body){
		
		if( (response.statusCode>=200) && (response.statusCode < 300)){
			
			var icon = findIconFromHtml(baseURL,response.headers['content-type'],body);
			
			if(icon!=''){
				//We have determined which icon must be retrieved, so fetch it.
				//Next step is to forward it to the customer.
				//TODO: add a notification to a cache/store system, then forward to client
				fetch(icon,serviceResponse,onIconDownloaded);
			}else{
				replyWithError(500,serviceResponse,'icon not found');
			}
		}else{
			replyWithError(500,serviceResponse,'failed to download html');
		}
	};
				
	//fetch the document specified in the service request
	//when it is downloaded, onHtmlDownloaded() is called
	//TODO: verify if a previous fetch has already cached the result.
	fetch(serviceRequest.body.domain,serviceResponse,onHtmlDownloaded);
	
}



//Main function: create a server and start it
var server = connect.createServer(connect.logger('dev')
	,connect.bodyParser()
	,iconCrawlerServiceHandler);

server.listen(8888);
