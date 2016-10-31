"use strict";
var testNum=0;
var v=[];
v.tb=[];
v.tb.put=function(){}
var g=[];
var plan=[0,4,3,2,1,0,0,0,0,0];
g._forces=plan;

function testFleetStat(){
try {
  var res,res1;
  var resArr3=[],resArr2=[],resArr=[];

  var i,j;
  
  document.write("Fleet\n");
  var f=new Fleet();
  f.ships=[];
  var testShip1=[ [1,2],[1,3],[1,4] ];
  f.ships.push(testShip1);
  var testShip2=[ [3,0],[3,1],[3,2],[3,3] ];
  f.ships.push(testShip2);
  
  document.write("checkHit\n");
  res=f.checkHit(2,3);
  assertEqualsPrim(false,res,"not false on a miss","miss");
  res1=f.checkHit(1,3);
  assertTrue(res1,"false on a hit","hit");
  assertEqualsPrim(testShip1,res1,"not the striken ship","hit ship"); // same array -- no need for join()
  
  document.write("makeHistogram\n");
  var his=f.makeHistogram();
  var hisExpected=[0,0,0,1,1,0,0,0,0,0];
  assertEqualsPrim(hisExpected.join(),his.join(),"wrong histogram","histogram");
  
  document.write("checkMargins\n");
  res=f.checkMargins();
  assertTrue(res,"false negative check","valid margins");
  f.ships.push([ [0,1] ]);
  res=f.checkMargins();
  assertTrue( !res,"positive on diagonal contact","diagonal contact");
  f.ships.pop();
  res=f.checkMargins();
  assertTrue(res,"false negative check","valid margins");
  f.ships.push([ [3,1] ]);  
  res=f.checkMargins();
  assertTrue( !res,"positive on overlap","overlap");
  
  document.write("ShipYard production\n");

  f.clear();
  assertEqualsPrim(0,f.ships.length,"not cleared","clear");  
  f.build("byForces");
  assertEqualsPrim(10,f.ships.length,"wrong number of ships","number");
  var resSy=f.checkMargins();
  assertTrue(resSy,"false negative margin check","valid margins");
  his=f.makeHistogram();
  assertEqualsPrim(plan.join(),his.join(),"wrong histogram","histogram");

  
  document.write("Stat\n");
  var s=new Stat();
  s.addStrike();
  s.addStrike();
  s.addHit();
  assertEqualsPrim(2,s._strikes,"wrong strikes","strikes");
  assertEqualsPrim(1,s._hits,"wrong hits","hits");
  s.setShips(hisExpected);
  assertEqualsPrim(2,s._shipsAlive,"wrong alive count","alive");
  assertEqualsPrim(4,s._biggestShip,"wrong biggest ship","biggest");
  
  document.write("minusOne\n");
  s.minusOne(testShip2); // only lenght will be used, no coords
  assertEqualsPrim(1,s._shipsAlive,"wrong alive count","minus alive");
  assertEqualsPrim(3,s._biggestShip,"wrong biggest ship","minus biggest");
  assertEqualsPrim(1,s._shipsSunk,"wrong sunk count","plus sunk");  
  
  
}
catch (err) {
  document.write("Terminated in/after "+testNum+"th test on: "+err+"\n");
}
}
testFleetStat();