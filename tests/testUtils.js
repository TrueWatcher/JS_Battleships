"use strict";

function TestHelper() {
  // It's a SINGLETON
  if (typeof TestHelper.instance === 'object') return TestHelper.instance;
  
  //var _this=this;
  this.out="";

  this.print=function (str) {
    if (str=="pre") {
      this.out="pre";
      this.target=document.createElement("pre");
      document.body.appendChild(this.target);
      this.target.style="font-size: 1.4em";
      return;
    }
    if (str=="console") {
      this.out="console";
      return;
    }
    if (this.out=="pre") {
      var output=this.target.innerHTML;
      this.target.innerHTML=output+str;
    }
    else console.log(str);
  }
  
  this.println=function (str) { this.print(str+"\n"); }
  
  this.printErr=function (numTest,err) {
    var out="";
    out+="Terminated in/after "+numTest+"th test on: "+err;
    if(err.lineNumber) out+=" {"+err.lineNumber+")";
    this.println(out);
  }

  TestHelper.instance=this;
}
  
var theTestHelper=new TestHelper();// we need one instance! or "new TEstHelper" everywhere

function assertTrue(statement,message,messageOK) {
  var t=TestHelper();
  //var tt=new TestHelper(); alert(">"+(t===t));
  testNum++;
  var out="";
  if(!statement) {
    t.println("Failure:"+message);
    throw testNum;
  }
  else {
    out+="Passed "+testNum;
    if(messageOK) out+=": "+messageOK;
    t.println(out);
  }
}

function assertEqualsPrim(expected,found,message,messageOK) {
  var t=TestHelper();
  testNum++;
  var out="";

  if( !(expected==found) ) {
    t.println("Failure: '"+found+"' does not equal to expected '"+expected+"' \n"+message+"\n");
    throw testNum;
  }
  else {
    out+="Passed "+testNum;
    if(messageOK) out+=": "+messageOK;
    t.println(out);
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