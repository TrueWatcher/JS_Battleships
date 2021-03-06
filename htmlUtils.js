"use strict";
/**
 * Alias for getElementById
 * @return DOMElement
 */
function $(id) {
  return( document.getElementById(id) );
}

/**
 * Puts content to given HTML element.
 * @param string str content
 * @param {string|DOMElement} id target element's Id or that element itself
 * @return nothing
 */
function putToElement(str,id) {
  var e;
  if ( id.nodeName ) e=id;
  else if ( typeof id =="string" ) {
    e=document.getElementById(id);
    if (!e) throw new Error("putToElement: invalid node id "+id);
  }
  else throw new Error("putToElement: invalid argument "+id);
  //var e=document.getElementById(id);
  e.innerHTML=str;
}

/**
 * Gets content from given HTML element (value or any attribute).
 * @param {string|DOMElement} id target element's Id or that element itself
 * @param string attr attribute name
 * @return string element.value or element.attribute.value
 */
function getElementValue(id,attr) {
  var e;
  if ( id.nodeName ) e=id;
  else if ( typeof id =="string" ) {
    e=document.getElementById(id);
    if (!e) throw new Error("getElementValue: invalid node id "+id);
  }
  else throw new Error("putToElement: invalid argument "+id);

  if (!attr) return (e.value);
  else  if (attr=="checked") return (e.checked);// important!
  else  return ( e.getAttribute(attr) );
}

/**
 * Toggles the display property of the given HTML element.
 * @param {string|DOMElement} id target element's Id or that element itself
 * @return nothing
 */
function toggleElement(id) {
  var e;
  if ( id.nodeName ) e=id;
  else if ( typeof id =="string" ) e=document.getElementById(id);
  else throw new Error("toggleElement: invalid argument "+id);
  var d=e.style.display;
  if (d=="none") e.style.display="";
  else e.style.display="none";
}

function displayElement(id) {
  var e;
  if ( id.nodeName ) e=id;
  else if ( typeof id =="string" ) e=document.getElementById(id);
  else throw new Error("toggleElement: invalid argument "+id);
  e.style.display="";  
}

function hideElement(id) {
  var e;
  if ( id.nodeName ) e=id;
  else if ( typeof id =="string" ) e=document.getElementById(id);
  else throw new Error("toggleElement: invalid argument "+id);
  e.style.display="none";  
}
 
/**
 * Iterates through table's cells, which have id.
 * @param DOMElement tableElement
 * @return DOMElement|boolean td element or false on end
 */
function TdIterator(tableElement) {

  if ( this.l ) { // prevent repeated instantiation
    this.i=0;
    return this;
  }
  
  this.list=tableElement.querySelectorAll("td[id]"); //makeList( tableElement );

  function makeList(parent) {
    var list=[];
    list=parent.querySelectorAll("td[id]");
    return list;
  }
  
  this.l=this.list.length;
  this.i=0;
  
  this.go=function() {
    var ret=false;
    if ( this.i >= this.l ) {
      this.i=0;
      return false;
    }
    ret=this.list[ this.i ];
    this.i+=1;
    return ret;
  }
}

/**
 * detects id of clicked table element (event delegation).
 * @param event
 * @return string id or false on failure
 */
function detectTd(event) {
  event = event || window.event;
  var target = event.target || event.srcElement;

  while(target.nodeName != 'TABLE') {
    if (target.nodeName == 'TD') { return (target.id); }
    target = target.parentNode;
  }
  return (false);
}

/**
 * Reads one value from browser's cookies store.
 * @param string name
 * @return string value
 */
function readCookie(name) {
// http://stackoverflow.com/questions/14573223/set-cookie-and-get-cookie-with-javascript
  var nameEQ = name + "=";
  var ca = document.cookie.split(';');
  for(var i=0;i < ca.length;i++) {
    var c = ca[i];
    while (c.charAt(0)==' ') c = c.substring(1,c.length);
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
  }
  return null;
}

/**
 * Removes cookies from browser's cookies store (limited by domain).
 */
function _deleteAllCookies() {
// http://stackoverflow.com/questions/179355/clearing-all-cookies-with-javascript
// did not work in FireFox
  var cookies = document.cookie.split(";");

  for (var i = 0; i < cookies.length; i++) {
      var cookie = cookies[i];
      var eqPos = cookie.indexOf("=");
      var name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }
}

function deleteAllCookies(showLog) {
// http://stackoverflow.com/questions/179355/clearing-all-cookies-with-javascript (end)  
    var arrCookies = document.cookie.split(';'),
        arrPaths = location.pathname.replace(/^\//, '').split('/'), //  remove leading '/' and split any existing paths
        arrTemplate = [ 'expires=Thu, 01-Jan-1970 00:00:01 GMT', 'path={path}', 'domain=' + window.location.host, 'secure=' ];  //  array of cookie settings in order tested and found most useful in establishing a "delete"
    for (var i in arrCookies) {
        var strCookie = arrCookies[i];
        if (typeof strCookie == 'string' && strCookie.indexOf('=') >= 0) {
            var strName = strCookie.split('=')[0];  //  the cookie name
            for (var j=1;j<=arrTemplate.length;j++) {
                if (document.cookie.indexOf(strName) < 0) break; // if this is true, then the cookie no longer exist
                else {
                    var strValue = strName + '=; ' + arrTemplate.slice(0, j).join('; ') + ';';  //  made using the temp array of settings, putting it together piece by piece as loop rolls on
                    if (j == 1) document.cookie = strValue;
                    else {
                        for (var k=0;k<=arrPaths.length;k++) {
                            if (document.cookie.indexOf(strName) < 0) break; // if this is true, then the cookie no longer exist
                            else {
                                var strPath = arrPaths.slice(0, k).join('/') + '/'; //  builds path line 
                                strValue = strValue.replace('{path}', strPath);
                                document.cookie = strValue;
                            }
                        }
                    }
                }
            }
        }
    }
    showLog && window['console'] && console.info && console.info("\n\tCookies Have Been Deleted!\n\tdocument.cookie = \"" + document.cookie + "\"\n");
    return document.cookie;
}

/**
 * A timer utility.
 * @param int millisecs delay
 * @constructor
 */ 
function Poll(millisecs) {
  if ( !millisecs ) millisecs=10000;
  this.handler=null;
  var _this=this;
  
  this.start=function() {
    if (!this.handler) {
      this.handler=window.setInterval(onPoll,millisecs);
      //alert("Poller started");
    }
  }
  
  this.stop=function() {
    //alert("Poller stopped");
    window.clearInterval(this.handler);
    this.handler=null;
  }
}

/**
 * A generic function for sending AJAX requests.
 * @param string qs query string
 * @return void
 */
function sendRequest (queryString,indicator) {
  if (typeof view1 != "undefined") indicator=view1.ap;
  
  if (!queryString) throw new Error ("sendRequest: empty query string");
  var responderUrl="hub.php";
  var urlOffset="";
  if (typeof URLOFFSET != "undefined") urlOffset=URLOFFSET;
  //alert("Request to be sent to "+urlOffset+responderUrl+"?"+queryString);
  //return false;
  
  var req=new XMLHttpRequest();
  
  //req.open("GET",responderUrl+"?"+queryBase+"&"+queryString); // GET
  //req.open("POST",responderUrl,true); // POST
  req.open("POST",urlOffset+responderUrl,true); // POST
  
  req.setRequestHeader("Content-Type","application/x-www-form-urlencoded");// for POST; should go _after_ req.open!
  
  req.onreadystatechange=function () { receive(req); };// both
  
  //var q=req.send(null); // GET
  var q=req.send(queryString); // POST
  
  //$("noteIntro").innerHTML="Connecting ...";
  if (indicator) indicator.ledOn();
}

/**
 * A generic function for receiving AJAX requests. Calls onAjaxReceived(responseText).
 * @param {object XHR} oReq
 */
function receive(oReq,indicator) {
  if (typeof view1 != "undefined") indicator=view1.ap;
  var note="";
  if (oReq.readyState == 4) {
    if(oReq.status==200) {
      if (indicator) indicator.ledOff();
      var rt=oReq.responseText;
      onAjaxReceived(rt);
    }
  }
}
