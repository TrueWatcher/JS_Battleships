<html>
<head>
<title>A minimal unit test for hub.php</title>
</title>
<body>
<pre>
<?php

require("hub.php");
RelaySqlt::destroy();
unset($controller);

function page($input,&$cookie) {
  print("\n----------\n");
  print("Input  : ".implode("+",$input)."\n");
  $controller=new HubManager($input,$cookie,"DetachedHubHelper");
  $ret=$controller->go();
  print("Reply  :".$ret."\n");
  print("Cookie : ".implode("+",$cookie)."\n");
  print("Trace  : ".$controller->trace."\n");
  RelaySqlt::destroy();
  unset($controller);
} 

$c1=[];
$i1=["intro"=>"register","playerName"=>"AAA","enemyName"=>"BBB"];

page($i1,$c1);

$c2=[];
$i2=["intro"=>"register","playerName"=>"BBB","enemyName"=>"AAA"];

page($i2,$c2);

$i1=["intro"=>"queryFull"];

page($i1,$c1);

$i2=["rules"=>"confirm"];

page($i2,$c2);

$i1=[ "rules"=>"updPick", "pick"=>"{\"firstMove\":1}" ];

page($i1,$c1);

$i2=[ "rules"=>"updPick", "pick"=>"{\"firstMove\":1}" ];

page($i2,$c2);

$i1=["rules"=>"confirm"];

page($i1,$c1);

$i2=["rules"=>"confirm"];

page($i2,$c2);

$i1=["rules"=>"queryPick"];

page($i1,$c1);
?>
</pre>
</body>
</html>