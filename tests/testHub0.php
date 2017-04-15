<html>
<head>
<title>A minimal unit test for hub.php</title>
</title>
<body>
<pre>
<?php
define("URLOFFSET", "../");// used also by RelaySqlt::_construct
unlink(URLOFFSET."game.db");

require(URLOFFSET."hub.php");
RelaySqlt::destroy();
unset($controller);

function page($input,&$cookie) {
  print("\n----------\n");
  print("Input  : ".implode("+",$input)."\n");
  $controller=new HubManager($input,$cookie,"DetachedHubHelper");
  $ret=$controller->go();
  print("Reply  : ".$ret."\n");
  print("Cookie : ".implode("+",$cookie)."\n");
  print("Trace  : ".$controller->trace."\n");
  //RelaySqlt::destroy();
  unset($controller);
  return(json_decode($ret,true));
}

$picks1='{ "firstMove":1, "forces":1, "strikeRule":0, "level":2 }';
$picks2='{ "firstMove":0, "forces":1, "strikeRule":1, "level":2 }';

$rules0='{ "firstActiveAB":"A", "forces":[0,4,3,2,1,0,0,0,0,0,0], "strikeRule":"oe", "demandEqualForces":1, "previewEnemyShips":0 }';
$rules1='{ "firstActiveAB":"B", "forces":[0,2,1,0,0,0,0,0,0,0,0], "strikeRule":"oe", "demandEqualForces":1, "previewEnemyShips":1 }';
$rules2='{ "firstActiveAB":"A", "forces":[0,2,1,0,0,0,0,0,0,0,0], "strikeRule":"bs", "demandEqualForces":1, "previewEnemyShips":1 }';

$ships1="[ [[9,9]], [[7,9]], [[1,2],[1,3]] ]";
$ships2="[ [[8,8]], [[7,7]], [[5,2],[5,3]] ]";
$ships3="[ [[8,8]], [[1,1]], [[5,2],[5,3],[5,4]] ]";
$ships4="[ [[8,8]], [[1,1]], [[5,2],[5,3]] ]";

//register AAA
$c1=[];
$i1=["intro"=>"register","playerName"=>"AAA","enemyName"=>"BBB"];
page($i1,$c1);

//register BBB
$c2=[];
$i2=["intro"=>"register","playerName"=>"BBB","enemyName"=>"AAA"];
//$i2=["intro"=>"register","playerName"=>"BBB","enemyName"=>"AAA","reqId"=>"BBB_B_1"];
page($i2,$c2);

//AAA queryAll
$i1=["intro"=>"queryAll"];
//$i1=["intro"=>"queryStage"];
page($i1,$c1);

//BBB rules confirm, expecting state converged>confirming
//$i2=["rules"=>"confirm", "rulesSet"=>$rules0];
//$r=page($i2,$c2);
$i2=["rules"=>"confirm", "rulesSet"=>$rules0, "reqId"=>"BBB_B_1"];
$c3=["dummy cookie"];
$r=page($i2,$c3);

//AAA rules updPick, expecting state confirming>picking
$i1=[ "rules"=>"updPick", "pick"=>$picks1 ];
page($i1,$c1);

//BBB rules updPick,expecting state picking>converged
$i2=[ "rules"=>"updPick", "pick"=>$picks1 ];
page($i2,$c2);

//BBB fight strike, expecting error note  
$i2=["fight"=>"strike", "thisMove"=>"1", "rc"=>"[5,5]" ];
$r=page($i2,$c2);

//AAA rules confirm,expecting state converged>confirming
$i1=["rules"=>"confirm", "rulesSet"=>$rules1];
page($i1,$c1);

//BBB rules confirm, expecting state confirming>ships
$i2=["rules"=>"confirm", "rulesSet"=>$rules1];
page($i2,$c2);

//AAA rules queryPick, expecting state=ships
$i1=["rules"=>"queryPick"];
page($i1,$c1);

//BBB ships confirmShips, expecting state=confirmingShips note=Wait
$i2=["ships"=>"confirmShips", "fleet"=>$ships1];
page($i2,$c2);

//AAA ships confirmShips with wrong margins, expecting state=confirmingShips note=Try new
$i1=["ships"=>"confirmShips", "fleet"=>$ships2];
page($i1,$c1);

//BBB queryStage expecting state=confirmingShips note=Wait
$i2=["ships"=>"queryStage"];
page($i2,$c2);

//AAA ships confirmShips with wrong size, expecting state=confirmingShips note=Try new
$i1=["ships"=>"confirmShips", "fleet"=>$ships3];
page($i1,$c1);

//BBB queryAll
$i2=["intro"=>"queryAll"];
page($i2,$c2);

//AAA confirmingShips expecting success state=fight
$i1=["ships"=>"confirmShips", "fleet"=>$ships4];
page($i1,$c1);

//BBB strike expecting miss "move"=[1,"B",5,5,"m"] activeSide=A
$i2=["fight"=>"strike", "thisMove"=>"1", "rc"=>"[5,5]" ];
$r=page($i2,$c2);
//print_r($r["move"]);
//echo(implode(",",$r["move"]));

//AAA strike expecting hit "move":[2,"A",1,2,"h"] "activeSide":"A" stats {"A":{"strikes":1,"hits":1,"afloat":3,"largest":2}}
$i1=["fight"=>"strike", "thisMove"=>2, "rc"=>"[1,2]" ];
$r=page($i1,$c1);
//echo(implode(",",$r["stats"]["A"]));

//AAA strike repeat move 2, expecting error
$i1=["fight"=>"strike", "thisMove"=>2, "rc"=>"[1,2]" ];
$r=page($i1,$c1);

//BBB strike expecting error
$i2=["fight"=>"strike", "thisMove"=>3, "rc"=>"[5,3]" ];
page($i2,$c2);

//AAA strike expecting sunk ship stats={"A":{"strikes":2,"hits":2,"afloat":3,"largest":2},"B":{"strikes":1,"hits":0,"afloat":2,"largest":1}}
$i1=["fight"=>"strike", "thisMove"=>3, "rc"=>"[1,3]" ];
$r=page($i1,$c1);

//BBB queryMoves expecting moves 2 and 3
$i2=["fight"=>"queryMoves","latest"=>1];
page($i2,$c2);

//AAA strike expecting hit "move":[4,"A",9,9,"w",[[9,9]]] stats
$i1=["fight"=>"strike", "thisMove"=>4, "rc"=>"[9,9]" ];
page($i1,$c1);

//BBB query all expecting moves 1-4
$i2=["intro"=>"queryAll"];
page($i2,$c2);

//AAA strike expecting final hit state=finish move=[5,"A",7,9,"f",[[7,9]]]
$i1=["fight"=>"strike", "thisMove"=>5, "rc"=>"[7,9]" ];
page($i1,$c1);

//BBB queryMoves expecting move 5, winner=A
$i2=["fight"=>"queryMoves","latest"=>4];
page($i2,$c2);

//AAA new expecting state=intro, note=register again
$i1=["finish"=>"new"];
page($i1,$c1);

//BBB more expecting state=intro, note=register again
$i2=["finish"=>"more"];
page($i2,$c2);

print("<br /><hr /><br />");

//register AA
$c1=[];
$i1=["intro"=>"register","playerName"=>"AA","enemyName"=>"BB"];
page($i1,$c1);

//register BB
$c2=[];
$i2=["intro"=>"register","playerName"=>"BB","enemyName"=>"AA"];
page($i2,$c2);

//AA updPick, expecting Ok
$i1=[ "rules"=>"updPick", "pick"=>$picks2 ];
page($i1,$c1);

//BB updPick, expecting Ok
$i2=[ "rules"=>"updPick", "pick"=>$picks2 ];
page($i2,$c2);

//AA confirm, expecting Ok
$i1=["rules"=>"confirm", "rulesSet"=>$rules2];
page($i1,$c1);

//BB confirm, expecting Ok stage=ships
$i2=["rules"=>"confirm", "rulesSet"=>$rules2];
page($i2,$c2);

//AA queryPick, expecting stage=ships state=ships
$i1=["rules"=>"queryPick"];
page($i1,$c1);

//BB confirmShips, expecting Ok
$i2=["ships"=>"confirmShips", "fleet"=>$ships1];
page($i2,$c2);

//AA confirmShips, expecting Ok stage=fight
$i1=["ships"=>"confirmShips", "fleet"=>$ships4];
page($i1,$c1);

//BB trying to repeat confirmShips
//$i2=["ships"=>"confirmShips", "fleet"=>$ships1];
//page($i2,$c2);

//BB queryAll
$i2=["intro"=>"queryAll"];
$r=page($i2,$c2);

//AA strike,expecting miss clip=1
$i1=["fight"=>"strike", "thisMove"=>"1", "rc"=>"[5,5]" ];
page($i1,$c1);

//BB queryMoves
$i2=["fight"=>"queryMoves", "latest"=>0];
page($i2,$c2);

//AA strike, expecting kill and active=BB
$i1=["fight"=>"strike", "thisMove"=>"2", "rc"=>"[9,9]" ];
page($i1,$c1);

//$i2=["fight"=>"queryMoves", "latest"=>1];
//BB re-register, expecting success and full info
$c2=[];
$i2=["intro"=>"register","playerName"=>"BB","enemyName"=>"AA"];
page($i2,$c2);

//AA queryMoves, expecting info but no moves yet
$i1=["fight"=>"queryMoves", "latest"=>2];
page($i1,$c1);
// 2 strikes

//BB strike expecting hit and clip=1
$i2=["fight"=>"strike", "thisMove"=>"3", "rc"=>"[5,2]" ];
page($i2,$c2);

//BB strike expecting kill 2-decker active=AA with clip=1
$i2=["fight"=>"strike", "thisMove"=>"4", "rc"=>"[5,3]" ];
page($i2,$c2);

//AA strike expecting kill active=BB with clip=2
$i1=["fight"=>"strike", "thisMove"=>"5", "rc"=>"[7,9]" ];
page($i1,$c1);
// only 1 strike, active>2

//BB queryMoves, expecting one #5
$i2=["fight"=>"queryMoves", "latest"=>4];
page($i2,$c2);

//BB strike expecting kill and clip=1
$i2=["fight"=>"strike", "thisMove"=>"6", "rc"=>"[8,8]" ];
page($i2,$c2);

//nBB strike expecting final kill and victory
$i2=["fight"=>"strike", "thisMove"=>"7", "rc"=>"[1,1]" ];
page($i2,$c2);

//AA queryMoves expecting #6 #7
$i1=["fight"=>"queryMoves", "latest"=>"5" ];
page($i1,$c1);

print("<br /><hr /><br />");

//AA more, expecting state finish>cyclingReq
$i1=["finish"=>"more"];
//$c1=[]; // test "Please, register"
page($i1,$c1);

//BB more, expecting new gameId, new cookie and stage=ships
$i2=["finish"=>"more"];
page($i2,$c2);

//AA more again, expecting new cookie, stage=ships state=ships
//$i1=["finish"=>"queryStage"];
$i1=["finish"=>"more"];
page($i1,$c1);

//BB confirmShips, expecting note=Wait
$i2=["ships"=>"confirmShips", "fleet"=>$ships1];
page($i2,$c2);

//AA confirmShips, expecting stage=fight active=BB
$i1=["ships"=>"confirmShips", "fleet"=>$ships4];
page($i1,$c1);

//BB queryAll, expecting rulesSet=rules2 activeSide=B clip=2
$i2=["intro"=>"queryAll"];
page($i2,$c2);

?>
</pre>
</body>
</html>