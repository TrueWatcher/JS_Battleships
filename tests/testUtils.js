"use strict";

function TestHelper() {
  // It's a SINGLETON
  if (typeof TestHelper.instance === 'object') return TestHelper.instance;
  
  //var _this=this;
  this._outTarget="console";
  this._outElement="";
  this._numOfTests=0;
  
  this.toPage=function(){ 
    this._outTarget="page"; 
    this._outElement=document.createElement("pre");
    document.body.appendChild(this._outElement);
    this._outElement.style="font-size: 1.4em";
    this._numOfTests=0;
  }
  
  this.addToPage=function(str) {
    var h=this._outElement.innerHTML;
    this._outElement.innerHTML=h+str;
  }
  
  this.toConsole=function() {
    this._outTarget="console";
    this._numOfTests=0;
  }
  
  this.checkToPage=function() { return (this._outTarget=="page"); }
  
  this.incCount=function() { this._numOfTests++ }
  this.getCount=function() { return(this._numOfTests) }
  
  TestHelper.instance=this;
}

function print (str) {
    var t=new TestHelper();
    if (str==">page") {
      t.toPage();
      return;
    }
    if (str==">console") {
      t.toConsole();
      return;
    }
    if (t.checkToPage()) {
      t.addToPage(str);
    }
    else console.log(str);
}
  
function println (str) { print(str+"\n"); }
  
function printErr (err) {
    var t=new TestHelper();
    var out="",f="",i;
    out+="Terminated in/after "+t.getCount()+"th test on: "+err;
    if(err.lineNumber) {
      var fn=err.fileName;
      if ( i=fn.lastIndexOf("/") ) {
        f=fn.substr(i+1,fn.length-i-1);
      }
      out+=" ("+f+":"+err.lineNumber+")";
    }
    println(out);
}

function assertTrue(statement,message,messageOK) {
  var t=new TestHelper();
  t.incCount();
  var out="";
  if(!statement) {
    println("Failure:"+message);
    throw t.getCount();
  }
  else {
    out+="Passed "+t.getCount();
    if(messageOK) out+=": "+messageOK;
    println(out);
  }
}

function assertEqualsPrim(expected,found,message,messageOK) {
  var t=new TestHelper();
  t.incCount();
  var out="";

  if( !(expected==found) ) {
    println("Failure: '"+found+"' does not equal to expected '"+expected+"' \n"+message+"\n");
    throw t.getCount();
  }
  else {
    out+="Passed "+t.getCount();
    if(messageOK) out+=": "+messageOK;
    println(out);
  }
}

function assertEqualsVect(expected,found,message,messageOK) {
  if ( !(expected instanceof Array) ) throw ("assertEqualsVect:1st argument is not Array");
  if ( !(found instanceof Array) ) throw ("assertEqualsVect:2nd argument is not Array");
  assertEqualsPrim(expected.join(),found.join(),message,messageOK);
}

function translateArray(arr) {
  var rn=new Seq2d();
  var rc,r,c,s;
  var res=[];
  for (var i=0;i<DIM;i++) {  res.push( (new Array(DIM)).fill(0) ) }
  while ( rc=rn.go() ) {
    r=rc[0];
    c=rc[1];
    if ( typeof arr[r] == "undefined" || arr[r][c]==0 ) s="e";
    else s="s";
    res[r][c] = s;
  }
  return res;
}
/*
function assertTrue(statement,message,messageOK) {
  testNum++;
  var out="";
  if(!statement) {
    document.write("Failure:"+message+"\n");
    throw testNum;
  }
  else {
    document.write("Passed "+testNum);
    if(messageOK) document.write(": "+messageOK);
    document.write("\n");
  }
}

function assertEqualsPrim(expected,found,message,messageOK) {
  testNum++;
  var out="";

  if( !(expected==found) ) {
    document.write("Failure: '"+found+"' does not equal to expected '"+expected+"' \n"+message+"\n");
    throw testNum;
  }
  else {
    document.write("Passed "+testNum);
    if(messageOK) document.write(": "+messageOK);
    document.write("\n");
  }
}
*/