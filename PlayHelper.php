<?php

class PlayHelper {
  
  static function adjAll($row,$col,$max=10) {
  // arrayUtils.js adjAll
    $res=[];
    for ($i=0; $i<=2; $i++) {
      for ($j=0; $j<=2; $j++) {
        if ( !($i==1 && $j==1) ) {
          $r=$row+$i-1;
          $c=$col+$j-1;
          if( $r>=0 && $r<$max && $c>=0 && $c<$max ) {
            $res[] = [$r,$c];
          }
        }
      }
    }
    return ($res);
  }
  
  static function around (Array $pointsArray) {
  // arrayUtils.js around
    //if ( !is_array($pointsArray) ) {  throw new Exception ("Usage error! Non-array or single-dimension array passed to 'around()' ");
      //return false;
    //}
    $res=[];
    $adjacent=[];
    //var rc,rca;
    for ($i=0;$i<count($pointsArray);$i++) {
      $rc=$pointsArray[$i];
      /*if (mode=="cross") adjacent=adjCross(rc[0],rc[1]);
      else*/
      $adjacent=self::adjAll($rc[0],$rc[1]);
      for ($j=0; $j < count($adjacent); $j++) {
        $rca=$adjacent[$j];
        if ( !in_array($rca,$pointsArray) && !in_array($rca,$res) ) $res[]=$rca;
      }
    }
    return($res);
  }
  
  static function validateFleet($shipsJson) {
    $shipsArray=json_decode($shipsJson);
    $fleetModel=[];
    // check margins like Fleet::checkMargins
    if (!is_array($shipsArray)) return ("Invalid data:".$shipsJson);
    foreach ($shipsArray as $ship0) {
      if(!is_array($ship0)) throw new Exception ("Invalid format 1");
      $around0=self::around($ship0);
      foreach ($shipsArray as $ship) {
        if ($ship==$ship0) continue;// both are coming from the same array, we may compare references
        foreach ($ship as $rc) {
          if (!is_array($rc) || count($rc)!=2) throw new Exception ("Invalid format 2");
          if (in_array($rc,$ship0) || in_array($rc,$around0)) return false;
        }
      }
    }
    // validated successfully, adding metadata
    foreach ($shipsArray as $ship) {
      $shipModel=[];
      foreach ($ship as $rc) { $shipModel[] = [ "rc"=>$rc, "h"=>0 ]; }
      $fleetModel[] = [ "sm"=>$shipModel, "s"=>0 ];
    }
    //self::makeFleetStat($fleetModel);
    return $fleetModel;
  }
  
  static function makeHistogram(Array $fleetModel) {
    $h=[0,0,0,0,0,0,0,0,0,0,0];// 11
    //if (!is_array($fleetModel)) throw new Exception ("Failed to find shipModels array");
    foreach ( $fleetModel as $shipModel ) {
      if ($shipModel["s"]===0) {
        $decks=count($shipModel["sm"]);
        $h[$decks]+=1;
      }
    }
    return ($h);
  }
  
  function makeFleetStat(&$fleetModel) {
    $stat=["afloat"=>0,"largest"=>0];
    $h=self::makeHistogram($fleetModel);
    for ($i=count($h)-1; $i>=0; $i--) {
      if ( $h[$i] > 0 ) {
        $stat["largest"]=$i;
        break;
      }
    }
    for ($j=$i;$j>=0;$j--) { $stat["afloat"] += $h[$j]; }
    //$fleetModel["largest"] = $stat["largest"];
    //$fleetModel["afloat"] = $stat["afloat"];
    return ($stat);
  }
  
  static function validateForces($fleetModel,$histogram) {
    $fh=self::makeHistogram($fleetModel);
    //echo(">".implode(",",$fh)." == ".implode(",",$histogram));
    if ( implode(",",$fh) == implode(",",$histogram) ) return true;
    return false;
  }
  
  static function unwrapShip(Array $shipModel) {
  // @return ship
    $ship=[];
    if (isset($shipModel["sm"])) $shipModel = $shipModel["sm"];// fleetUnit > shipModel
    //var_dump($shipModel);
    //var_dump($shipModel["sm"]);
    if ( !is_array($shipModel) ) throw new Exception ("Failed to find points array");
    
    foreach($shipModel as $pointModel) {
      if ( !isset($pointModel["rc"]) || !is_array($pointModel["rc"]) ) throw new Exception ("Failed to find point");
      $ship[]=$pointModel["rc"];
    }
    return ($ship);
  }
  
  static function unwrapFleet($fleetModel) {
    $r=[];
    if ($fleetModel=="{}" || $fleetModel=="[]" || empty($fleetModel)) return $r;
    if (is_string($fleetModel)) { $fleetModel=json_decode($fleetModel,true); }
    if (!is_array($fleetModel)) throw new Exception ("Invalid fleetModel :".$fleetModel."!");
    
    foreach ($fleetModel as $fleetUnit) {
      $r[]=self::unwrapShip($fleetUnit);
    }
    return ($r);
  }
  
  static function checkHit ($point, &$fleetModel) {
    if (!is_array($point) || count($point)!=2) throw new Exception ("Invalid point");
    $hit="";
    foreach ($fleetModel as &$fleetUnit) {
      $shipModel=&$fleetUnit["sm"];
      $sunk=&$fleetUnit["s"];// check the sunk ships also, result will be "n"
      $wounds=0;
      $decks=count($shipModel);
      foreach ($shipModel as &$pointModel) {
        $rc=$pointModel["rc"];
        $collides= ( implode($rc,",") == implode($point,",") );
        $isHit=&$pointModel["h"];
        if ($isHit) { 
          $wounds++;
          if ($collides) return ("n");// hit on already hit point
        }
        else if ($collides) {
          $wounds++;
          $isHit=1;
          $hit="h";
          //break;
        }
      }// end of points cycle
      if ($hit) {
        //echo(" hit ".$wounds." squares of ".$decks." " );
        if ($wounds==$decks) {
          $sunk=1;
          //return ("w");
          return ( self::unwrapShip($shipModel) );
        }
        else { return($hit); }
      }
    }// end of ships cycle
    return ("m");
  }
  
  static function checkAllSunk($fleetModel) {
    foreach ($fleetModel as $fleetUnit) {
      $sunk=$fleetUnit["s"];
      if (!$sunk) return false;
    }
    return true;
  }
  
  static function makeStrikesStat($hit,$active,$statObj) {
    if (!is_array($statObj)) $statObj=json_decode($statObj,true);
    if (!$statObj) throw new Exception ("Wrong statObj :".$statObj."!");
    $r=[];
    $strikes = $statObj[$active]["strikes"] + 1;
    $hits = $statObj[$active]["hits"];
    if (in_array($hit,["h","w","f"])) $hits++;
    $r["strikes"]=$strikes;
    $r["hits"]=$hits;
    return $r;
  }
  
  static function addToStats(&$statObj,$side,Array $what) {
    $count=0;
    foreach ( ["strikes","hits","afloat","largest"] as $k ) {
      if (isset($what[$k])) {
        $statObj[$side][$k] = $what[$k];
        $count++;
      }
    }
    if (!$count) throw new Exception ("No valid keys");
  }
  
  static function encodeMove ($count,$side,$rc,$result,$sunk=null) {
    // move = [ count, r, c, hit ]
    $r=[ $count, $side, $rc[0], $rc[1], $result ];
    if ($sunk) $r[]=$sunk;
    return (json_encode($r));
    //return ( "[".implode(",",$r)."]" ); gives error because of m instead of "m"
  }
  
  static function decodeMove ($entry,&$count,&$side,&$rc,&$result,&$sunk) {
    //$entry=susstr($entry, 1, strlen($entry)-2 );
    $arr=json_decode($entry);
    $count=$arr[0];
    $side=$arr[1];
    $rc[0]=$arr[2];
    $rc[1]=$arr[3];
    $result=$arr[4];
    if (isset($arr[5])) $sunk=$arr[5];
    else $sunk=null;
  }
  
  static function defineActive ( $hit, Game $g, &$noteToNowActive ) {
    if ($hit=="f") {
      $noteToNowActive="You have won !";
      return false;
    }
    $noteToNowActive="";
    $nowActive = $g->getActive();
    $newActive=$nowActive;
    $strikeRule = json_decode( $g->rulesSet, true ) ["strikeRule"];
    // add to clip ?
    if ( $strikeRule=="oe" && in_array($hit,["h","w"]) ) {
      //echo(" +1 move =".$g->getClip());
      $g->incClip();
    } 
    // change side ?
    if ( $g->getClip() === 0 ) {
      $newActive = Game::getOtherSide( $nowActive );
      $noteToNowActive="Enemy is striking";
      $g->setClip ( self::loadClip($newActive,$g) );
      $g->setActive ($newActive);
      return $newActive;
    }
    else { 
      if ($strikeRule=="oe") $noteToNowActive="You have hit the enemy, make an extra move";
      else $noteToNowActive=$g->getClip()." strikes left";
    }
    // no change
    return false;
  }
  
  static function loadClip ( $newActive, Game $g ) {
    $strikeRule = json_decode( $g->rulesSet, true ) ["strikeRule"];
    $stats = json_decode( $g->stats, true );
    if ( $strikeRule=="oe" ) { 
      $clip=1;
      //$note="Make your move";
    }
    else if ( $strikeRule=="bs" ) {
      $clip = $stats [$newActive] ["largest"];
      if ($clip==0) throw new Exception ("Zero largest ship at ".$newActive);
      //$note="Make your move";
    }
    else throw new Exception ("Wrong strikeRule:".$strikeRule."!");
    //$g->clip = $clip;
    return $clip;
  }
  
  static function fullInfo($side,Game $g/*,&$stage,&$state*/) {
    $hc="HubHelper";
    if (!class_exists($hc)) throw new Exception ("Include all dependencies");
    $otherSide=Game::getOtherSide($side);
    $err=null;
    $r=null;
    $note="";
    $stage=$g->getStage();
    $state=$g->getState();
    switch ($stage) {
    case "intro":
      if ( $state=="intro" || ( $state=="connecting" && ! $g->isActive($side) ) ) { 
        $err = "You should not be registered yet";
        break;
      } else if ($state=="connecting") {
        $r = $hc::notePairs( "Wait for your opponent ".$g->getName($otherSide), $g, ["state", "players", "activeSide"] ); 
        break;
      } 
      $err="Invalid stage/state :".$stage."/".$state."!";
      break;
      
    case "rules":
      if ( $state=="confirming" && $g->isActive($side) ) {
        $r=$hc::notePairs("Wait for your opponent", $g, ["state","players","picks","rulesSet"]);
        break;
      }
      $r=$hc::notePairs("Make an agreement", $g, ["state","players","picks"]);
      break;
      
    case "ships":
      if ($state=="ships") {
        $r = $hc::notePairs( "Draw your ships",$g,["state","players","picks","rulesSet"] );
        break;
      }
      if ($state=="confirmingShips" && $g->isActive($otherSide) ) {
        $r = $hc::notePairs( "Draw your ships, your opponent is ready",$g,["state","players","picks","rulesSet"] );
        break;      
      }
      if ($state=="confirmingShips" && $g->isActive($side) ) {
        $r = $hc::notePairs ($note, $g, ["state","players","picks","rulesSet"]);
        $yourFleet = PlayHelper::unwrapFleet ( $g->ships[$side] );
        if (!is_array($yourFleet)) throw new Exception ("Failed to unwrap ships from ".$g->ships[$side]);
        $yourFleetJson=json_encode($yourFleet);
        $r = $hc::appendToJson( $r, '"fleet":{"'.$side.'":'.$yourFleetJson.'}' );
        break;      
      }
      $err="Invalid stage/state :".$stage."/".$state."!";
      break;
      
    case "fight":
      if ( $g->isActive($side) ) { $note="Make your move"; }
      else { $note="Enemy is striking"; }
      $r = $hc::notePairs ( $note, $g, [ "state", "players", "rulesSet", "moves", "stats", "activeSide", "clip"] );
      $yourFleet = PlayHelper::unwrapFleet ( $g->ships[$side] );
      if ( ! is_array($yourFleet) ) throw new Exception ("Failed to unwrap ships from ".$g->ships[$side]);
      $yourFleetJson=json_encode($yourFleet);
      $r = $hc::appendToJson( $r, '"fleet":{"'.$side.'":'.$yourFleetJson.'}' );
      break;
      
    case "finish":
    case "aborted":
      //$r = $hc::noteState("Game is ".$stage."!",$state);
      $note="Game is ".$stage."ed !";
      $r = $hc::notePairs ( $note, $g, [ "state", "players", "rulesSet", "moves", "stats", "activeSide", "clip"] );
      if ($g->winner) $r = $hc::appendToJson( $r, $g->exportPair(["winner"]) );
      break;
      
    default:
    
      $err="Invalid stage/state :".$stage."/".$state."!";
      break;
    }
    if (!$err && !$r) throw new Exception ("No error and no return value");
    if ($err) {
      $r = $hc::fail($err);
    }
    return ($r);
  
  }
}
?>