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
}

$picks1='{ "firstMove":1, "forces":1, "strikeRule":0, "level":2 }';
$picks2='{ "firstMove":0, "forces":1, "strikeRule":1, "level":2 }';

$rules1='{ "firstActiveAB":"B", "forces":[0,2,1,0,0,0,0,0,0,0,0], "strikeRule":"oe", "demandEqualForces":1, "previewEnemyShips":1 }';
$rules2='{ "firstActiveAB":"A", "forces":[0,2,1,0,0,0,0,0,0,0,0], "strikeRule":"bs", "demandEqualForces":1, "previewEnemyShips":1 }';

$ships1="[ [[9,9]], [[7,9]], [[1,2],[1,3]] ]";
$ships2="[ [[8,8]], [[7,7]], [[5,2],[5,3]] ]";
$ships3="[ [[8,8]], [[1,1]], [[5,2],[5,3],[5,4]] ]";
$ships4="[ [[8,8]], [[1,1]], [[5,2],[5,3]] ]";

$c1=[];
$i1=["intro"=>"register","playerName"=>"AAA","enemyName"=>"BBB"];
page($i1,$c1);

$c2=[];
$i2=["intro"=>"register","playerName"=>"BBB","enemyName"=>"AAA"];
page($i2,$c2);

$i1=["intro"=>"queryAll"];
page($i1,$c1);

$i2=["rules"=>"confirm"];
page($i2,$c2);

$i1=[ "rules"=>"updPick", "pick"=>$picks1 ];
page($i1,$c1);

$i2=[ "rules"=>"updPick", "pick"=>$picks1 ];
page($i2,$c2);

$i1=["rules"=>"confirm", "rulesSet"=>$rules1];
page($i1,$c1);

$i2=["rules"=>"confirm", "rulesSet"=>$rules1];
page($i2,$c2);

$i1=["rules"=>"queryPick"];
page($i1,$c1);

$i2=["ships"=>"confirmShips", "fleet"=>$ships1];
page($i2,$c2);

$i1=["ships"=>"confirmShips", "fleet"=>$ships2];
page($i1,$c1);

$i2=["ships"=>"queryStage"];
page($i2,$c2);

$i1=["ships"=>"confirmShips", "fleet"=>$ships3];
page($i1,$c1);

$i2=["intro"=>"queryAll"];
page($i2,$c2);

$i1=["ships"=>"confirmShips", "fleet"=>$ships4];
page($i1,$c1);

$i2=["fight"=>"strike", "thisMove"=>"1", "rc"=>"[5,5]" ];
page($i2,$c2);

$i1=["fight"=>"strike", "thisMove"=>2, "rc"=>"[1,2]" ];
page($i1,$c1);

$i2=["fight"=>"strike", "thisMove"=>3, "rc"=>"[5,3]" ];
page($i2,$c2);

$i1=["fight"=>"strike", "thisMove"=>3, "rc"=>"[1,3]" ];
page($i1,$c1);

$i2=["fight"=>"queryMoves","latest"=>1];
page($i2,$c2);

$i1=["fight"=>"strike", "thisMove"=>4, "rc"=>"[9,9]" ];
page($i1,$c1);

$i2=["intro"=>"queryAll"];
page($i2,$c2);

$i1=["fight"=>"strike", "thisMove"=>5, "rc"=>"[7,9]" ];
page($i1,$c1);

$i2=["fight"=>"queryMoves","latest"=>4];
page($i2,$c2);

$i1=["finish"=>"new"];
page($i1,$c1);

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