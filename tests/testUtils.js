"use strict";

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

function translateArray(arr) {
  var rn=new Seq2d();
  var rc,r,c,s;
  var res=[];
  for (var i=0;i<DIM;i++) {  res.push( (new Array(DIM)).fill(0) ) }
  //new Array(DIM*DIM);
  //res.fill(0);
  while ( rc=rn.go() ) {
    r=rc[0];
    c=rc[1];
    if( typeof arr[r] == "undefined" || arr[r][c]==0 ) s="e";
    else s="s";
    res [r] [c] = s;
  }
  return res;
}