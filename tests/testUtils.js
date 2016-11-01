"use strict";

function TestHelper() {
  // It's a SINGLETON
  if (typeof TestHelper.instance === 'object') return TestHelper.instance;
  
  //var _this=this;
  this._outTarget="console";
  this._outElement="";
  
  this.toPage=function(){ 
    this._outTarget="page"; 
    this._outElement=document.createElement("pre");
    document.body.appendChild(this._outElement);
    this._outElement.style="font-size: 1.4em";
  }
  
  this.addToPage=function(str) {
    var h=this._outElement.innerHTML;
    this._outElement.innerHTML=h+str;
  }
  
  this.toConsole=function() { this._outTarget="console"; }
  
  this.checkToPage=function() { return (this._outTarget=="page"); }
  
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
  
function printErr (numTest,err) {
    var out="",f="",i;
    out+="Terminated in/after "+numTest+"th test on: "+err;
    if(err.lineNumber) {
      var fn=err.fileName;
      if ( i=fn.lastIndexOf("/") ) {
        f=fn.substr(i+1,fn.length-i-1);
      }
      out+=" ("+f+":"+err.lineNumber+")";
    }
    println(out);
}

//var theTestHelper=new TestHelper();// we need one instance! or "new TEstHelper" everywhere

function assertTrue(statement,message,messageOK) {
  var t=new TestHelper();
  //var tt=new TestHelper(); alert(">"+(t===t));
  testNum++;
  var out="";
  if(!statement) {
    println("Failure:"+message);
    throw testNum;
  }
  else {
    out+="Passed "+testNum;
    if(messageOK) out+=": "+messageOK;
    println(out);
  }
}

function assertEqualsPrim(expected,found,message,messageOK) {
  var t=new TestHelper();
  testNum++;
  var out="";

  if( !(expected==found) ) {
    println("Failure: '"+found+"' does not equal to expected '"+expected+"' \n"+message+"\n");
    throw testNum;
  }
  else {
    out+="Passed "+testNum;
    if(messageOK) out+=": "+messageOK;
    println(out);
  }
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