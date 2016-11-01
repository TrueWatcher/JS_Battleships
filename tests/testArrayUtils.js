"use strict";
var testNum=0;
function testArrayUtils() {
try {
  
  var res;
  var resArr3=[],resArr2=[],resArr=[];
  
  var i,j;

  print(">page");
  //print(">console");
  
  println("\narrayUtils\n");
  
  println("adjAll");
  resArr=adjAll(3,3);
  assertEqualsPrim(8,resArr.length,"not 8 for a inside point","inside");
  resArr=adjAll(0,0);
  assertEqualsPrim(3,resArr.length,"not 3 for a corner point","corner");  
  resArr=adjAll(0,2);
  assertEqualsPrim(5,resArr.length,"not 5 for a side point","side");
  resArr=adjAll(3,3,4);
  assertEqualsPrim(3,resArr.length,"not 3 for a corner point","added size");
  
  println("adjCross");
  resArr=adjCross(3,3);
  assertEqualsPrim(4,resArr.length,"not 4 for a inside point","inside");  
  resArr=adjCross(0,0);
  assertEqualsPrim(2,resArr.length,"not 2 for a corner point","corner");  
  resArr=adjCross(0,2);
  assertEqualsPrim(3,resArr.length,"not 3 for a side point","side");
  resArr=adjCross(3,3,4);
  assertEqualsPrim(2,resArr.length,"not 2 for a corner point","added size");
  
  println("Seq2d");
  var range=new Seq2d();
  while ( res=range.go() ) { resArr2.push(res) }
  assertEqualsPrim(100,resArr2.length,"wrong total","total");
  assertTrue(resArr2[10][0]==1 && resArr2[10][1]==0,"wrong 10th pair","10th pair");
  
  println("Rand2d,indexOfVect");  
  var rnd=new Rand2d();
  var rc=[];
  var resArr4=resArr2.slice();
  for (var k=0;k<100;k++) {
    rc=rnd.go();
    i=resArr2.indexOfVect(rc);
    if (i<0) break;
    resArr2.splice(i,1);
  }
  assertTrue(i>=0,"some pair is missing","all pairs");
  assertEqualsPrim(0,resArr2.length,"not empty after deleting all","all pairs");
  rc=rnd.go();
  assertTrue(resArr4.indexOfVect(rc)>=0,"some pair is missing","new cycle");
  
  println("createArray");
  resArr3=createArray(21,"21");
  assertEqualsPrim(21,resArr3.length,"wrong length","length");
  var e=resArr3.every( function(x){ return x==="21" } );
  assertTrue(e,"wrong filling","fill");
  
  println("around");
  e=around( [1,2,3] );
  assertEqualsPrim(false,e,"not false for single-dimn array","single-dim");  
  var testArr1=[ [0,0],[0,1],[0,2] ];
  var resArr5=around(testArr1);
  assertEqualsPrim(5,resArr5.length,"length not 5 for 3-corner","length");
  assertTrue(resArr5.indexOfVect([1,3])>=0,"1,3 pair is missing","1,3 pair");
  e=testArr1.every( function(rc) { return resArr5.indexOfVect(rc)<0 } );
  assertTrue(e,"some source pair in result","source");
  
  println("arraySwap01");
  var testArr2=[ [1,2],["a","b"],[3,4] ];
  arraySwap01(testArr2);
  assertEqualsPrim("1,2",testArr2[1].join(),"0th pair not found in 1st position","0->1");  
  assertEqualsPrim("a,b",testArr2[0].join(),"1th pair not found in 0th position","1->0");  
}
catch (err) {
  printErr(testNum,err);
}
}
testArrayUtils();//new TestHelper()