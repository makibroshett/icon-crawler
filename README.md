Icon-crawler package

This is a sample nodeJS application which implements a web-service responsible for fetching a website 'icon'.
It is a simple exercise to get a first taste of NodeJS.

Given a web site URL, the web service is responsible for:
* retrieving an icon from the web site, among the variety of 'link rel="xxx-icon"' or favicon.ico that may exist for the given web page.
* archive/cache the icon for further faster access
* groom the cache & update it should icons be changed on the various queried websites.

The service is available on port 8888 and there is no way to change that for now.

To query the service:
* send a post request to the service: domain=<fully qualified domain name>

For example to exert the service on google.com, using curl : curl -d google.com http://127.0.0.1:8888/icon-crawler


The service returns HTTP replies:
* if a match was found: 200 status with an image content type and the icon in the entity body
* if no match was found: 404 status 
* if an internal service error occured: 500

