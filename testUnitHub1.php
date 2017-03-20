<?php

unlink("game.db");

require("hub.php");
RelaySqlt::destroy();
unset($controller);

function respond($input,&$cookie) {
  //print("\n----------\n");
  //print("Input  : ".implode("+",$input)."\n");
  $controller=new HubManager($input,$cookie,"DetachedHubHelper");
  $ret=$controller->go(null);
  //print("Reply  : ".$ret."\n");
  //print("Cookie : ".implode("+",$cookie)."\n");
  print("Trace  : ".$controller->trace."\n");
  //RelaySqlt::destroy();
  unset($controller);
  return(json_decode($ret,true));
}

function parseTrace($trace,&$inState,&$outState) {
  if (is_array($trace)) $trace=$trace["trace"];
  if ( !is_string($trace) || strlen($trace)===0 || strpos($trace,">") ) throw new Exception("parseTrace: invalid argument");
  $separator=">";
  $a=explode($separator,$trace);
  //print_r($a);
  $inState=$a[2];
  $outState=$a[4];
  return($inState.$separator.$outState);
}

function implodePlus($arg,$separator=",") {
  if (is_string($arg)) {
    try { $arr=json_decode($arg,true); } 
    catch (Exception $e) { throw new Exception("implodePlus: argument1=".$arg." is string but not a valid json"); }
  }
  else if (is_array($arg)) { $arr=$arg; }
  else throw new Exception("implodePlus: argument1=".$arg." is of invalid type");
  
  $r="";
  foreach($arr as $key=>$val) {
    if (!is_array($val)) $r.=$separator.$val;
    else $r.=$separator.implodePlus($val);
  }
  return ltrim($r,$separator);
}


class Test_Hub_basic extends PHPUnit_Framework_TestCase {

  public function test_regRulesShipsFightOeNew() {
    
    $picks0='{ "firstMove":0, "forces":0, "strikeRule":0, "level":0 }';
    $picks1='{ "firstMove":1, "forces":1, "strikeRule":0, "level":2 }';
    $picks2='{ "firstMove":0, "forces":1, "strikeRule":1, "level":2 }';

    $rules0='{ "firstActiveAB":"A", "forces":[0,4,3,2,1,0,0,0,0,0,0], "strikeRule":"oe", "demandEqualForces":1, "previewEnemyShips":0 }';
    $rules1='{ "firstActiveAB":"B", "forces":[0,2,1,0,0,0,0,0,0,0,0], "strikeRule":"oe", "demandEqualForces":1, "previewEnemyShips":1 }';
    $rules2='{ "firstActiveAB":"A", "forces":[0,2,1,0,0,0,0,0,0,0,0], "strikeRule":"bs", "demandEqualForces":1, "previewEnemyShips":1 }';

    $ships1="[ [[9,9]], [[7,9]], [[1,2],[1,3]] ]";
    $ships2="[ [[8,8]], [[7,7]], [[5,2],[5,3]] ]";
    $ships3="[ [[8,8]], [[1,1]], [[5,2],[5,3],[5,4]] ]";
    $ships4="[ [[8,8]], [[1,1]], [[5,2],[5,3]] ]";

    echo("\nregister AAA\n");
    $c1=[];
    $i1=["intro"=>"register","playerName"=>"AAA","enemyName"=>"BBB"];
    $r=respond($i1,$c1);
    $this->assertEquals ( "AAA,A,1", implode(",",$c1), "wrong cookie" );
    $this->assertEquals ( "AAA,BBB", implodePlus($r["players"]), "wrong Players" );
    $this->assertEquals ( "zero>connecting", parseTrace($r,$is,$os), "wrong states" );
    $this->assertEquals ( "intro", $r["stage"], "wrong Stage");
    $this->assertEquals ( "connecting", $r["state"], "wrong State");

    echo("\nregister BBB\n");
    $c2=[];
    $i2=["intro"=>"register","playerName"=>"BBB","enemyName"=>"AAA"];
    $r=respond($i2,$c2);
    $this->assertEquals ( "BBB,B,1", implode(",",$c2), "wrong cookie" );
    $this->assertEquals ( "AAA,BBB", implodePlus($r["players"]), "wrong Players" );
    $this->assertEquals ( "connecting>converged", parseTrace($r,$is,$os), "wrong states" );
    $this->assertEquals ( "rules", $r["stage"], "wrong Stage");
    $this->assertEquals ( "converged", $r["state"], "wrong State");
    
    echo("\nAAA queryAll\n");
    $i1=["intro"=>"queryAll"];
    $r=respond($i1,$c1);
    $this->assertEquals ( "rules", $r["stage"], "wrong Stage");
    $this->assertEquals ( "converged", $r["state"], "wrong State");
    $this->assertEquals ( "converged>converged", parseTrace($r,$is,$os), "wrong inner states" );
    $this->assertEquals ( implodePlus($picks0), implode(",",$r["picks"]["A"]), "wrong PicksA" );
    $this->assertEquals ( implodePlus($picks0), implode(",",$r["picks"]["B"]), "wrong PicksB" );

    echo("\nBBB rules confirm, expecting state converged>confirming\n");
    $i2=["rules"=>"confirm", "rulesSet"=>$rules0];
    $r=respond($i2,$c2);
    $this->assertEquals ( "converged>confirming", parseTrace($r,$is,$os), "wrong states" );
    $this->assertEquals ( "confirming", $r["state"], "wrong State" );    

    echo("\nAAA rules updPick, expecting state confirming>picking\n");
    $i1=[ "rules"=>"updPick", "pick"=>$picks1 ];
    $r=respond($i1,$c1);
    $this->assertEquals ( "confirming>picking", parseTrace($r,$is,$os), "wrong states" );
    $this->assertEquals ( "picking", $r["state"], "wrong State" );
    $this->assertEquals ( implodePlus($picks0), implode(",",$r["picks"]["B"]), "wrong PicksB" );

    echo("\nBBB rules updPick, expecting state picking>converged\n");
    $i2=[ "rules"=>"updPick", "pick"=>$picks1 ];
    $r=respond($i2,$c2);
    $this->assertEquals ( "picking>converged", parseTrace($r,$is,$os), "wrong states" );
    $this->assertEquals ( "converged", $r["state"], "wrong State" );
    $this->assertEquals ( implodePlus($picks1), implode(",",$r["picks"]["A"]), "wrong PicksA" );

    echo("\nAAA rules confirm, expecting state converged>confirming\n");
    $i1=["rules"=>"confirm", "rulesSet"=>$rules1];
    $r=respond($i1,$c1);
    //$this->assertEquals ( "converged>confirming", parseTrace($r,$is,$os), "wrong states" );
    $this->assertEquals ( "confirming", $r["state"], "wrong State" );
    $this->assertEquals ( "rules", $r["stage"], "wrong Stage");

    echo("\nBBB rules confirm, expecting state confirming>ships\n");
    $i2=["rules"=>"confirm", "rulesSet"=>$rules1];
    $r=respond($i2,$c2);
    //$this->assertEquals ( "confirming>ships", parseTrace($r,$is,$os), "wrong states" );
    $this->assertEquals ( "ships", $r["state"], "wrong State" );
    $this->assertEquals ( "ships", $r["stage"], "wrong Stage");
    
    echo("\nAAA rules queryPick, expecting state=ships\n");
    $i1=["rules"=>"queryPick"];
    $r=respond($i1,$c1);
    $this->assertEquals ( "ships>ships", parseTrace($r,$is,$os), "wrong states" );
    $this->assertEquals ( implodePlus($picks1), implode(",",$r["picks"]["B"]), "wrong PicksB" );

    echo("\nBBB ships confirmShips, expecting state=confirmingShips note=Wait\n");
    $i2=["ships"=>"confirmShips", "fleet"=>$ships1];
    $r=respond($i2,$c2);
    $this->assertEquals ( "ships>confirmingShips", parseTrace($r,$is,$os), "wrong states" );
    $this->assertEquals ( "confirmingShips", $r["state"], "wrong State" );
    $this->assertContains( "Wait", $r["note"], "wrong Note" );
    
    echo("\nAAA ships confirmShips with wrong margins, expecting state=confirmingShips note=Try new\n");
    $i1=["ships"=>"confirmShips", "fleet"=>$ships2];
    $r=respond($i1,$c1);
    $this->assertEquals ( "confirmingShips>confirmingShips", parseTrace($r,$is,$os), "wrong states" );
    $this->assertContains( "Try new", $r["note"], "wrong Note" );

    echo("\nBBB queryStage expecting state=confirmingShips note=Wait\n");
    $i2=["ships"=>"queryStage"];
    $r=respond($i2,$c2);
    $this->assertEquals ( "confirmingShips", $r["state"], "wrong state" );
    $this->assertContains( "Wait", $r["note"], "wrong Note" );

    echo("\nAAA ships confirmShips with wrong size, expecting state=confirmingShips note=Try new\n");
    $i1=["ships"=>"confirmShips", "fleet"=>$ships3];
    $r=respond($i1,$c1);
    //$this->assertEquals ( "confirmingShips", $r["state"], "wrong state" );
    $this->assertEquals ( "confirmingShips>confirmingShips", parseTrace($r,$is,$os), "wrong states" );
    $this->assertContains( "Try new", $r["note"], "wrong Note" );

    echo("\nBBB queryAll\n");
    $i2=["intro"=>"queryAll"];
    $r=respond($i2,$c2);
    $this->assertEquals ( "ships", $r["stage"], "wrong Stage");
    $this->assertEquals ( "confirmingShips", $r["state"], "wrong State" );
    $this->assertEquals ( "AAA,BBB", implodePlus($r["players"]), "wrong Players" );
    $this->assertEquals ( implodePlus($picks1), implode(",",$r["picks"]["A"]), "wrong PicksA" );
    $this->assertEquals ( implodePlus($picks1), implode(",",$r["picks"]["B"]), "wrong PicksB" );
    $this->assertEquals ( implodePlus($rules1), implodePlus($r["rulesSet"]), "wrong RulesSet" );
    $this->assertEquals ( implodePlus($ships1), implodePlus($r["fleet"]["B"]), "wrong FleetB" );

    echo("\nAAA confirmingShips, expecting success state=fight\n");
    $i1=["ships"=>"confirmShips", "fleet"=>$ships4];
    $r=respond($i1,$c1);
    $this->assertEquals ( "confirmingShips>fight", parseTrace($r,$is,$os), "wrong states" );
    $this->assertEquals ( "fight", $r["stage"], "wrong Stage");
    $this->assertEquals ( "fight", $r["state"], "wrong State" );
    $this->assertEquals ( "B", $r["activeSide"], "wrong ActiveSide");
    $this->assertEquals ( "0,0,3,2,0,0,3,2", implodePlus($r["stats"]), "wrong Stats");

    echo("\nBBB strike, expecting miss move=1,B,5,5,m activeSide=A\n");
    $i2=["fight"=>"strike", "thisMove"=>"1", "rc"=>"[5,5]" ];
    $r=respond($i2,$c2);
    $this->assertEquals ( "fight", $r["stage"], "wrong Stage");
    $this->assertEquals ( "1,B,5,5,m", implode($r["move"],","), "wrong Move");
    $this->assertEquals ( "0,0,3,2,1,0,3,2", implodePlus($r["stats"]), "wrong Stats");
    $this->assertEquals ( "A", $r["activeSide"], "wrong ActiveSide");

    echo("\nAAA strike, expecting hit move=2,A,1,2,h activeSide=A statsA=1,1,3,2\n");
    $i1=["fight"=>"strike", "thisMove"=>2, "rc"=>"[1,2]" ];
    $r=respond($i1,$c1);
    $this->assertEquals ( "2,A,1,2,h", implode($r["move"],","), "wrong Move");
    $this->assertEquals ( "1,1,3,2,1,0,3,2", implodePlus($r["stats"]), "wrong Stats");
    $this->assertEquals ( "A", $r["activeSide"], "wrong ActiveSide");
    $this->assertContains( "extra move", $r["note"], "wrong Note" );

    echo("\nAAA strike repeat move 2, expecting error\n");
    $i1=["fight"=>"strike", "thisMove"=>2, "rc"=>"[1,2]" ];
    $r=respond($i1,$c1);
    $this->assertFalse(isset($r["move"]),"a Move on repeat");
    $this->assertNotEmpty($r["error"],"missing Error on repeat");
    $this->assertContains( "count is 2", $r["note"], "wrong Note" );
    
    echo("\nBBB strike, expecting error\n");
    $i2=["fight"=>"strike", "thisMove"=>3, "rc"=>"[5,3]" ];
    $r=respond($i2,$c2);
    $this->assertContains( "Active side is A", $r["note"], "wrong Note" );
    $this->assertNotEmpty( $r["error"], "wrong Error" );
    
    echo("\nAAA strike, expecting sunk ship statsA=2,2,3,2 B+1,0,2,1\n");
    $i1=["fight"=>"strike", "thisMove"=>3, "rc"=>"[1,3]" ];
    $r=respond($i1,$c1);
    $this->assertEquals ( "3,A,1,3,w,1,2,1,3", implodePlus($r["move"]), "wrong Move");
    $this->assertEquals ( "2,2,3,2,1,0,2,1", implodePlus($r["stats"]), "wrong Stats");
    $this->assertEquals ( "A", $r["activeSide"], "wrong ActiveSide");
    $this->assertContains( "extra move", $r["note"], "wrong Note" );    
    
    echo("\nBBB queryMoves, expecting moves 2 and 3\n");
    $i2=["fight"=>"queryMoves","latest"=>1];
    $r=respond($i2,$c2);
    $this->assertEquals ( "fight", $r["stage"], "wrong Stage");
    $this->assertEquals ( "fight", $r["state"], "wrong State");
    $this->assertEquals ( "A", $r["activeSide"], "wrong ActiveSide");
    $this->assertEquals ( "2,A,1,2,h,3,A,1,3,w,1,2,1,3", implodePlus($r["moves"]), "wrong Moves");
    $this->assertEquals ( "2,2,3,2,1,0,2,1", implodePlus($r["stats"]), "wrong Stats");

    echo("\nAAA strike, expecting hit move=4,A,9,9,w,9,9\n");
    $i1=["fight"=>"strike", "thisMove"=>4, "rc"=>"[9,9]" ];
    $r=respond($i1,$c1);
    $this->assertEquals ( "4,A,9,9,w,9,9", implodePlus($r["move"]), "wrong Move");
    $this->assertEquals ( "3,3,3,2,1,0,1,1", implodePlus($r["stats"]), "wrong Stats");
    $this->assertEquals ( "A", $r["activeSide"], "wrong ActiveSide");
    $this->assertContains( "extra move", $r["note"], "wrong Note" );    
    
    echo("\nBBB query all, expecting moves 1-4\n");
    $i2=["intro"=>"queryAll"];
    $r=respond($i2,$c2);
    $this->assertEquals ( "fight", $r["stage"], "wrong Stage");
    $this->assertEquals ( "fight", $r["state"], "wrong State" );
    $this->assertEquals ( "AAA", $r["players"]["A"], "wrong Players" );
    $this->assertEquals ( "BBB", $r["players"]["B"], "wrong Players" );
    //$this->assertEquals ( implodePlus($picks1), implode(",",$r["picks"]["A"]), "wrong PicksA" );
    //$this->assertEquals ( implodePlus($picks1), implode(",",$r["picks"]["B"]), "wrong PicksB" );
    $this->assertEquals ( implodePlus($rules1), implodePlus($r["rulesSet"]), "wrong RulesSet" );
    $this->assertEquals ( implodePlus($ships1), implodePlus($r["fleet"]["B"]), "wrong FleetB" );
    $this->assertEquals ( "A", $r["activeSide"], "wrong ActiveSide");
    $this->assertEquals ( "3,3,3,2,1,0,1,1", implodePlus($r["stats"]), "wrong Stats");
    $this->assertContains( "Enemy is striking", $r["note"], "wrong Note" );
    $this->assertEquals ( "1,B,5,5,m,2,A,1,2,h,3,A,1,3,w,1,2,1,3,4,A,9,9,w,9,9", implodePlus($r["moves"]), "wrong Moves");

    echo("\nAAA strike, expecting final hit state=finish move=5,A,7,9,f,7,9\n");
    $i1=["fight"=>"strike", "thisMove"=>5, "rc"=>"[7,9]" ];
    $r=respond($i1,$c1);
    $this->assertEquals ( "finish", $r["stage"], "wrong Stage");
    $this->assertEquals ( "finish", $r["state"], "wrong State" );
    $this->assertEquals ( "5,A,7,9,f,7,9", implodePlus($r["move"]), "wrong Move");
    $this->assertEquals ( "4,4,3,2,1,0,0,0", implodePlus($r["stats"]), "wrong Stats");
    $this->assertEquals ( "A", $r["activeSide"], "wrong ActiveSide");
    $this->assertEquals ( "A", $r["winner"], "wrong Winner");
    $this->assertContains( "YOU HAVE WON", $r["note"], "wrong Note" );     

    echo("\nBBB queryMoves, expecting move 5, winner=A\n");
    $i2=["fight"=>"queryMoves","latest"=>4];
    $r=respond($i2,$c2);
    $this->assertEquals ( "finish", $r["stage"], "wrong Stage");
    $this->assertEquals ( "finish", $r["state"], "wrong State" );    
    $this->assertEquals ( "5,A,7,9,f,7,9", implodePlus($r["moves"]), "wrong Moves");
    $this->assertEquals ( "A", $r["winner"], "wrong Winner");
    $this->assertContains( "ENEMY HAS WON", $r["note"], "wrong Note" );    
    
    echo("\nAAA new, expecting state=intro, note=register again\n");
    $i1=["finish"=>"new"];
    $r=respond($i1,$c1);
    $this->assertEquals ( "intro", $r["stage"], "wrong Stage");
    $this->assertEquals ( "intro", $r["state"], "wrong State" );
    $this->assertContains( "register again", $r["note"], "wrong Note" );
    //print_r($c1);
    $this->assertEmpty($c1,"cookie not cleared on server");

    echo("\nBBB more, expecting state=intro, note=register again\n");
    $i2=["finish"=>"more"];
    $r=respond($i2,$c2);
    $this->assertEquals ( "intro", $r["stage"], "wrong Stage");
    $this->assertEquals ( "intro", $r["state"], "wrong State" );
    $this->assertContains( "register again", $r["note"], "wrong Note" );
    $this->assertEmpty($c2,"cookie not cleared on server");
  }
  
  public function test_regFightBsMore() {
    
    $picks0='{ "firstMove":0, "forces":0, "strikeRule":0, "level":0 }';
    $picks1='{ "firstMove":1, "forces":1, "strikeRule":0, "level":2 }';
    $picks2='{ "firstMove":0, "forces":1, "strikeRule":1, "level":2 }';

    $rules0='{ "firstActiveAB":"A", "forces":[0,4,3,2,1,0,0,0,0,0,0], "strikeRule":"oe", "demandEqualForces":1, "previewEnemyShips":0 }';
    $rules1='{ "firstActiveAB":"B", "forces":[0,2,1,0,0,0,0,0,0,0,0], "strikeRule":"oe", "demandEqualForces":1, "previewEnemyShips":1 }';
    $rules2='{ "firstActiveAB":"A", "forces":[0,2,1,0,0,0,0,0,0,0,0], "strikeRule":"bs", "demandEqualForces":1, "previewEnemyShips":1 }';

    $ships1="[ [[9,9]], [[7,9]], [[1,2],[1,3]] ]";
    $ships2="[ [[8,8]], [[7,7]], [[5,2],[5,3]] ]";
    $ships3="[ [[8,8]], [[1,1]], [[5,2],[5,3],[5,4]] ]";
    $ships4="[ [[8,8]], [[1,1]], [[5,2],[5,3]] ]";

    echo("\nregister AA\n");
    $c1=[];
    $i1=["intro"=>"register","playerName"=>"AA","enemyName"=>"BB"];
    $r=respond($i1,$c1);
    $this->assertEquals ( "AA,A,2", implode(",",$c1), "wrong cookie" );
    $this->assertEquals ( "AA", $r["players"]["A"], "wrong PlayersA" );
    $this->assertEquals ( "BB", $r["players"]["B"], "wrong PlayersB" );
    $this->assertEquals ( "zero>connecting", parseTrace($r,$is,$os), "wrong states" );

    echo("\nregister BB\n");
    $c2=[];
    $i2=["intro"=>"register","playerName"=>"BB","enemyName"=>"AA"];
    $r=respond($i2,$c2);
    $this->assertEquals ( "BB,B,2", implode(",",$c2), "wrong cookie" );
    $this->assertEquals ( "rules", $r["stage"], "wrong Stage");
    $this->assertEquals ( "AA", $r["players"]["A"], "wrong PlayersA" );
    $this->assertEquals ( "BB", $r["players"]["B"], "wrong PlayersB" );
    $this->assertEquals ( "connecting>converged", parseTrace($r,$is,$os), "wrong states" );

    echo("\nAA updPick, expecting Ok\n");
    $i1=[ "rules"=>"updPick", "pick"=>$picks2 ];
    $r=respond($i1,$c1);
    $this->assertEquals ( "converged>picking", parseTrace($r,$is,$os), "wrong states" );

    echo("\nBB updPick, expecting Ok\n");
    $i2=[ "rules"=>"updPick", "pick"=>$picks2 ];
    $r=respond($i2,$c2);
    $this->assertEquals ( "picking>converged", parseTrace($r,$is,$os), "wrong states" );

    echo("\nAA confirm, expecting Ok\n");
    $i1=["rules"=>"confirm", "rulesSet"=>$rules2];
    $r=respond($i1,$c1);
    $this->assertEquals ( "converged>confirming", parseTrace($r,$is,$os), "wrong states" );

    echo("\nBB confirm, expecting Ok stage=ships\n");
    $i2=["rules"=>"confirm", "rulesSet"=>$rules2];
    $r=respond($i2,$c2);
    $this->assertEquals ( "confirming>ships", parseTrace($r,$is,$os), "wrong states" );
    $this->assertEquals ( "ships", $r["stage"], "wrong Stage");

    echo("\nAA queryPick, expecting stage=ships state=ships\n");
    $i1=["rules"=>"queryPick"];
    $r=respond($i1,$c1);
    $this->assertEquals ( "ships", $r["stage"], "wrong Stage");
    $this->assertEquals ( "ships", $r["state"], "wrong State");

    echo("\nBB confirmShips, expecting Ok\n");
    $i2=["ships"=>"confirmShips", "fleet"=>$ships1];
    $r=respond($i2,$c2);
    $this->assertEquals ( "ships>confirmingShips", parseTrace($r,$is,$os), "wrong states" );

    echo("\nAA confirmShips, expecting Ok stage=fight\n");
    $i1=["ships"=>"confirmShips", "fleet"=>$ships4];
    $r=respond($i1,$c1);
    $this->assertEquals ( "fight", $r["stage"], "wrong Stage");
    $this->assertEquals ( "fight", $r["stage"], "wrong State");
    
    //BB trying to repeat confirmShips
    //$i2=["ships"=>"confirmShips", "fleet"=>$ships1];
    //$r=respond($i2,$c2);
    
    echo("\nBB queryAll\n");
    $i2=["intro"=>"queryAll"];
    $r=respond($i2,$c2);
    $this->assertEquals ( "fight", $r["stage"], "wrong Stage");
    $this->assertEquals ( "fight", $r["state"], "wrong State");
    $this->assertEquals ( "AA", $r["players"]["A"], "wrong PlayerA");
    $this->assertEquals ( "BB", $r["players"]["B"], "wrong PlayerB");
    $this->assertEquals ( implodePlus($rules2), implodePlus($r["rulesSet"]), "wrong RulesSet");
    $this->assertEquals ( "A", $r["activeSide"], "wrong ActiveSide");
    $this->assertTrue ( isset($r["fleet"]["B"]) && !isset($r["fleet"]["A"]), "wrong Fleet side" );
    $this->assertEquals ( implodePlus($ships1), implodePlus($r["fleet"]), "wrong FleetB");
    
    echo("\nAA strike,expecting miss clip=1\n");
    $i1=["fight"=>"strike", "thisMove"=>"1", "rc"=>"[5,5]" ];
    $r=respond($i1,$c1);
    $this->assertEquals ( "1,A,5,5,m", implodePlus($r["move"]), "wrong Move");
    $this->assertEquals ( "1,0,3,2,0,0,3,2", implodePlus($r["stats"]), "wrong Stats");
    $this->assertEquals ( "A", $r["activeSide"], "wrong ActiveSide");
    $this->assertEquals ( "1", $r["clip"], "wrong Clip");
    $this->assertContains ( "1 strike", $r["note"], "wrong Note");

    echo("\nBB queryMoves\n");
    $i2=["fight"=>"queryMoves", "latest"=>0];
    $r=respond($i2,$c2);
    $this->assertEquals ( "1,A,5,5,m", implodePlus($r["moves"]), "wrong Moves");
    $this->assertEquals ( "fight", $r["state"], "wrong State");
    $this->assertEquals ( "fight", $r["stage"], "wrong Stage");
    $this->assertEquals ( "A", $r["activeSide"], "wrong ActiveSide");
    $this->assertContains ( "Enemy", $r["note"], "wrong Note");

    echo("\nAA strike, expecting kill and active=BB\n");
    $i1=["fight"=>"strike", "thisMove"=>"2", "rc"=>"[9,9]" ];
    $r=respond($i1,$c1);
    $this->assertEquals ( "2,A,9,9,w,9,9", implodePlus($r["move"]), "wrong Move");
    $this->assertEquals ( "2,1,3,2,0,0,2,2", implodePlus($r["stats"]), "wrong Stats");
    $this->assertEquals ( "B", $r["activeSide"], "wrong ActiveSide");
    $this->assertEquals ( "2", $r["clip"], "wrong Clip");
    $this->assertContains ( "Enemy", $r["note"], "wrong Note");    

    echo("\nBB re-register, expecting success and full info\n");
    $c2=[];
    $i2=["intro"=>"register","playerName"=>"BB","enemyName"=>"AA"];
    $r=respond($i2,$c2);
    $this->assertEquals ( "BB,B,2", implode(",",$c2), "wrong cookie on re-registration" );
    $this->assertEquals ( "fight", $r["state"], "wrong State");
    $this->assertEquals ( "fight", $r["stage"], "wrong Stage");
    $this->assertEquals ( "AA", $r["players"]["A"], "wrong PlayerA");
    $this->assertEquals ( "BB", $r["players"]["B"], "wrong PlayerB");
    $this->assertEquals ( implodePlus($rules2), implodePlus($r["rulesSet"]), "wrong RulesSet");    
    $this->assertEquals ( "B", $r["activeSide"], "wrong ActiveSide");
    $this->assertEquals ( "2", $r["clip"], "wrong Clip");
    $this->assertEquals ( "1,A,5,5,m,2,A,9,9,w,9,9", implodePlus($r["moves"]), "wrong Moves");
    $this->assertEquals ( "2,1,3,2,0,0,2,2", implodePlus($r["stats"]), "wrong Stats");
    $this->assertContains ( "your move", $r["note"], "wrong Note"); 

    echo("\nAA queryMoves, expecting info but no moves yet\n");
    $i1=["fight"=>"queryMoves", "latest"=>2];
    $r=respond($i1,$c1);
    $this->assertEquals ( "fight", $r["state"], "wrong State");
    $this->assertEquals ( "fight", $r["stage"], "wrong Stage");
    //$this->assertEquals ( "B", $r["activeSide"], "wrong ActiveSide");
    $this->assertContains ( "BB is thinking", $r["note"], "wrong Note");
    $this->assertFalse ( isset($r["moves"]), "false Moves" );

    echo("\nBB strike expecting hit and clip=1\n");
    $i2=["fight"=>"strike", "thisMove"=>"3", "rc"=>"[5,2]" ];
    $r=respond($i2,$c2);
    $this->assertEquals ( "B", $r["activeSide"], "wrong ActiveSide");
    $this->assertEquals ( "1", $r["clip"], "wrong Clip");
    $this->assertEquals ( "3,B,5,2,h", implodePlus($r["move"]), "wrong Move");
    $this->assertEquals ( "2,1,3,2,1,1,2,2", implodePlus($r["stats"]), "wrong Stats");

    echo("\nBB strike expecting kill 2-decker active=AA with clip=1\n");
    $i2=["fight"=>"strike", "thisMove"=>"4", "rc"=>"[5,3]" ];
    $r=respond($i2,$c2);
    $this->assertEquals ( "A", $r["activeSide"], "wrong ActiveSide");
    $this->assertEquals ( "1", $r["clip"], "wrong Clip after sinking the biggest ship");
    $this->assertEquals ( "4,B,5,3,w,5,2,5,3", implodePlus($r["move"]), "wrong Move");
    $this->assertEquals ( "2,1,2,1,2,2,2,2", implodePlus($r["stats"]), "wrong Stats");

    echo("\nAA strike expecting kill active=BB with clip=2 \n");
    $i1=["fight"=>"strike", "thisMove"=>"5", "rc"=>"[7,9]" ];
    $r=respond($i1,$c1);
    $this->assertEquals ( "B", $r["activeSide"], "wrong ActiveSide");
    $this->assertEquals ( "2", $r["clip"], "wrong Clip");
    $this->assertEquals ( "5,A,7,9,w,7,9", implodePlus($r["move"]), "wrong Move");
    $this->assertEquals ( "3,2,2,1,2,2,1,2", implodePlus($r["stats"]), "wrong Stats");

    echo("\nBB queryMoves, expecting one #5\n");
    $i2=["fight"=>"queryMoves", "latest"=>4];
    $r=respond($i2,$c2);
    $this->assertEquals ( "B", $r["activeSide"], "wrong ActiveSide");
    $this->assertEquals ( "2", $r["clip"], "wrong Clip");
    $this->assertEquals ( "5,A,7,9,w,7,9", implodePlus($r["moves"]), "wrong Moves");
    $this->assertEquals ( "3,2,2,1,2,2,1,2", implodePlus($r["stats"]), "wrong Stats");
    $this->assertContains ( "your move", $r["note"], "wrong Note"); 

    echo("\nBB strike expecting kill and clip=1\n");
    $i2=["fight"=>"strike", "thisMove"=>"6", "rc"=>"[8,8]" ];
    $r=respond($i2,$c2);
    $this->assertEquals ( "B", $r["activeSide"], "wrong ActiveSide");
    $this->assertEquals ( "1", $r["clip"], "wrong Clip");
    $this->assertEquals ( "6,B,8,8,w,8,8", implodePlus($r["move"]), "wrong Move");
    $this->assertEquals ( "3,2,1,1,3,3,1,2", implodePlus($r["stats"]), "wrong Stats");
    $this->assertContains ( "1 strikes left", $r["note"], "wrong Note"); 

    echo("\nBB strike expecting final kill and victory\n");
    $i2=["fight"=>"strike", "thisMove"=>"7", "rc"=>"[1,1]" ];
    $r=respond($i2,$c2);
    $this->assertEquals ( "7,B,1,1,f,1,1", implodePlus($r["move"]), "wrong Move");
    $this->assertEquals ( "3,2,0,0,4,4,1,2", implodePlus($r["stats"]), "wrong Stats");
    $this->assertEquals ( "finish", $r["state"], "wrong State");
    $this->assertEquals ( "finish", $r["stage"], "wrong Stage");
    $this->assertContains ( "YOU HAVE WON", $r["note"], "wrong Note");
    $this->assertEquals ( "B", $r["activeSide"], "wrong ActiveSide");
    $this->assertEquals ( "B", $r["winner"], "wrong Winner");

    echo("\nAA queryMoves expecting #6 #7\n");
    $i1=["fight"=>"queryMoves", "latest"=>"5" ];
    $r=respond($i1,$c1);
    $this->assertEquals ( "6,B,8,8,w,8,8,7,B,1,1,f,1,1", implodePlus($r["moves"]), "wrong Moves");
    $this->assertEquals ( "3,2,0,0,4,4,1,2", implodePlus($r["stats"]), "wrong Stats");
    $this->assertEquals ( "finish", $r["state"], "wrong State");
    $this->assertEquals ( "finish", $r["stage"], "wrong Stage");
    $this->assertEquals ( "B", $r["winner"], "wrong Winner");
    $this->assertContains ( "ENEMY HAS WON", $r["note"], "wrong Note");

    echo("\nAA more, expecting state finish>cyclingReq\n");
    $i1=["finish"=>"more"];
    $r=respond($i1,$c1);

    echo("\nBB more, expecting state cyclingReq>cyclingOk\n");
    $i2=["finish"=>"more"];
    $r=respond($i2,$c2);

    //echo("\nAA queryStage, expecting stage=ships state=ships\n");
    //$i1=["finish"=>"queryStage"];
    echo("\nAA more again, expecting stage=ships state=ships\n");
    $i1=["finish"=>"more"];
    $r=respond($i1,$c1);

    //print("<br /><hr /><br />");

    echo("\nBB confirmShips, expecting note=Wait\n");
    $i2=["ships"=>"confirmShips", "fleet"=>$ships1];
    $r=respond($i2,$c2);

    echo("\nAA confirmShips, expecting stage=fight active=BB\n");
    $i1=["ships"=>"confirmShips", "fleet"=>$ships4];
    $r=respond($i1,$c1);

    echo("\nBB queryAll, expecting rulesSet=rules2\n");
    $i2=["intro"=>"queryAll"];
    $r=respond($i2,$c2);
  }
}
?>