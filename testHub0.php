<html>
<head>
<title>A minimal unit test for hub.php</title>
</title>
<body>
<pre>
<?php

unlink("game.db");

require("hub.php");
RelaySqlt::destroy();
unset($controller);

function page($input,&$cookie) {
  print("\n----------\n");
  print("Input  : ".implode("+",$input)."\n");
  $controller=new HubManager($input,$cookie,"DetachedHubHelper");
  $ret=$controller->go(null);
  print("Reply  : ".$ret."\n");
  print("Cookie : ".implode("+",$cookie)."\n");
  print("Trace  : ".$controller->trace."\n");
  //RelaySqlt::destroy();
  unset($controller);
  return(json_decode($ret,true));
}

function parseTrace($trace,&$inState,&$outState) {
  if (is_array($trace)) $trace=$trace["trace"];
  if ( !is_string($trace) || strlen($trace)===0 || strpos($trace,">") ) throw new Exceptioon("parseTrace: invalid argument");
  $a=explode(">",$trace);
  //print_r($a);
  $inState=$a[2];
  $outState=$a[4];
}

function deepImplode($arr,$separator=",") {
  $r="";
  foreach($arr as $key=>$val) {
    if (!is_array($val)) $r.=$separator.$val;
    else $r.=$separator.deepImplode($val);
  }
  return ltrim($r,$separator);
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
page($i2,$c2);

//AAA queryAll
$i1=["intro"=>"queryAll"];
page($i1,$c1);

//BBB rules confirm, expecting state converged>confirming
$i2=["rules"=>"confirm", "rulesSet"=>$rules0];
$r=page($i2,$c2);
//parseTrace($r,$inState,$outState);
//echo("\n".$inState.">".$outState."\n");

//AAA rules updPick, expecting state confirming>picking
$i1=[ "rules"=>"updPick", "pick"=>$picks1 ];
page($i1,$c1);

//BBB rules updPick,expecting state picking>converged
$i2=[ "rules"=>"updPick", "pick"=>$picks1 ];
page($i2,$c2);

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

//BBB strike expecting error
$i2=["fight"=>"strike", "thisMove"=>3, "rc"=>"[5,3]" ];
page($i2,$c2);

//AAA strike expecting sunk ship stats={"A":{"strikes":2,"hits":2,"afloat":3,"largest":2},"B":{"strikes":1,"hits":0,"afloat":2,"largest":1}}
$i1=["fight"=>"strike", "thisMove"=>3, "rc"=>"[1,3]" ];
$r=page($i1,$c1);
//print_r($r["move"]);
echo(deepImplode($r["move"]));

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

$c1=[];
$i1=["intro"=>"register","playerName"=>"AA","enemyName"=>"BB"];
page($i1,$c1);

$c2=[];
$i2=["intro"=>"register","playerName"=>"BB","enemyName"=>"AA"];
page($i2,$c2);

$i1=[ "rules"=>"updPick", "pick"=>$picks2 ];
page($i1,$c1);

$i2=[ "rules"=>"updPick", "pick"=>$picks2 ];
page($i2,$c2);

$i1=["rules"=>"confirm", "rulesSet"=>$rules2];
page($i1,$c1);

$i2=["rules"=>"confirm", "rulesSet"=>$rules2];
page($i2,$c2);

$i1=["rules"=>"queryPick"];
page($i1,$c1);

$i2=["ships"=>"confirmShips", "fleet"=>$ships1];
page($i2,$c2);

$i1=["ships"=>"confirmShips", "fleet"=>$ships4];
page($i1,$c1);

$i2=["ships"=>"confirmShips", "fleet"=>$ships1];
page($i2,$c2);

$i1=["fight"=>"strike", "thisMove"=>"1", "rc"=>"[5,5]" ];
page($i1,$c1);

$i2=["fight"=>"queryMoves", "latest"=>0];
page($i2,$c2);

$i1=["fight"=>"strike", "thisMove"=>"2", "rc"=>"[9,9]" ];
page($i1,$c1);

//$i2=["fight"=>"queryMoves", "latest"=>1];
$c2=[];
$i2=["intro"=>"register","playerName"=>"BB","enemyName"=>"AA"];
page($i2,$c2);

$i1=["fight"=>"queryMoves", "latest"=>2];
page($i1,$c1);
// 2 strikes

$i2=["fight"=>"strike", "thisMove"=>"3", "rc"=>"[5,2]" ];
page($i2,$c2);

$i2=["fight"=>"strike", "thisMove"=>"4", "rc"=>"[5,3]" ];
page($i2,$c2);

$i1=["fight"=>"strike", "thisMove"=>"5", "rc"=>"[7,9]" ];
page($i1,$c1);
// only 1 strike, active>2

$i2=["fight"=>"queryMoves", "latest"=>4];
page($i2,$c2);

$i2=["fight"=>"strike", "thisMove"=>"6", "rc"=>"[8,8]" ];
page($i2,$c2);

$i2=["fight"=>"strike", "thisMove"=>"7", "rc"=>"[1,1]" ];
page($i2,$c2);

$i1=["fight"=>"queryMoves", "latest"=>"5" ];
page($i1,$c1);

$i1=["finish"=>"more"];
page($i1,$c1);

$i2=["finish"=>"more"];
page($i2,$c2);

//$i1=["finish"=>"queryStage"];
$i1=["finish"=>"more"];
page($i1,$c1);

print("<br /><hr /><br />");

$i2=["ships"=>"confirmShips", "fleet"=>$ships1];
page($i2,$c2);

$i1=["ships"=>"confirmShips", "fleet"=>$ships4];
page($i1,$c1);

$i2=["intro"=>"queryAll"];
page($i2,$c2);

?>
</pre>
</body>
</html>