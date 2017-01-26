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
    $fleetModel=["fleet"=>[],"afloat"=>null,"largest"=>null];
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
      $fleetModel["fleet"][] = [ "sm"=>$shipModel, "s"=>0 ];
    }
    self::makeStat($fleetModel);
    return $fleetModel;
  }
  
  static function makeHistogram($fleetModel) {
    $h=[0,0,0,0,0,0,0,0,0,0,0];// 11
    if (!is_array($fleetModel["fleet"])) throw new Exception ("Failed to find shipModels array");
    foreach ( $fleetModel["fleet"] as $shipModel ) {
      if ($shipModel["s"]===0) {
        $decks=count($shipModel["sm"]);
        $h[$decks]+=1;
      }
    }
    return ($h);
  }
  
  function makeStat(&$fleetModel) {
    $stat=["afloat"=>0,"largest"=>0];
    $h=self::makeHistogram($fleetModel);
    for ($i=count($h)-1; $i>=0; $i--) {
      if ( $h[$i] > 0 ) {
        $stat["largest"]=$i;
        break;
      }
    }
    for ($j=$i;$j>=0;$j--) { $stat["afloat"] += $h[$j]; }
    $fleetModel["largest"] = $stat["largest"];
    $fleetModel["afloat"] = $stat["afloat"];
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
    //var_dump($shipModel);
    //var_dump($shipModel["sm"]);
    if ( !is_array($shipModel) ) throw new Exception ("Failed to find points array");    
    foreach($shipModel as $pointModel) {
      if ( !isset($pointModel["rc"]) || !is_array($pointModel["rc"]) ) throw new Exception ("Failed to find point");
      $ship[]=$pointModel["rc"];
    }
    return ($ship);
  }
  
  static function checkHit($point,&$fleetModel) {
    if (!is_array($point) || count($point)!=2) throw new Exception ("Invalid point");
    $hit="";
    foreach ($fleetModel["fleet"] as &$fleetUnit) {
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
          break;
        }
      }// end of points cycle
      if ($hit) {
        echo("hit ".$wounds." of ".$decks);
        if ($wounds==$decks) {
          $sunk=1;
          //return ("w");
          return ( self::unwrapShip($shipModel) );
        }
        else { return("h"); }
      }
    }// end of ships cycle
    return ("m");
  }
  
  static function checkAllSunk($fleetModel) {
    foreach ($fleetModel["fleet"] as $fleetUnit) {
      $sunk=$fleetUnit["s"];
      if (!$sunk) return false;
    }
    return true;
  }
  
  static function encodeMove ($count,$side,$rc,$result) {
    // move = [ count, r, c, hit ]
    $r=[ $count, $side, $rc[0], $rc[1], $result ];
    return (json_encode($r));
    //return ( "[".implode(",",$r)."]" ); gives error because of m instead of "m"
  }
  
  static function decodeMove ($entry,&$count,&$side,&$rc,&$result) {
    $entry=susstr($entry, 1, strlen($entry)-2 );
    $arr=explode(",",$entry);
    $count=$arr[0];
    $side=$arr[1];
    $rc[0]=$arr[2];
    $rc[1]=$arr[3];
    $result=$arr[4];
  }
  
  static function defineActive ( $hit, $g, &$noteToNowActive ) {
    if ($hit=="f") {
      $noteToNowActive="You have won !";
      return false;
    }
    $noteToNowActive="";
    $nowActive = $g->getActive();
    $newActive=$nowActive;
    $clip = $g->clip;
    $strikeRule = json_decode( $g->rules, true ) ["strikeRule"];
    // add to clip ?
    if ( $strikeRule=="oe" && in_array($hit,["h","w"]) ) {
      echo(" +1 move =".$clip);
      $clip+=1;
      $g->clip = $clip;
    } 
    // change side ?
    if ( $clip===0 ) {
      $newActive = Game::getOtherSide( $nowActive );
      $noteToNowActive="Enemy is striking";
      $g->clip = self::loadClip($newActive,$g);
      $g->setActive ($newActive);
      return $newActive;
    }
    else { 
      if ($strikeRule=="oe") $noteToNowActive="You have hit the enemy, make an extra move";
      else $noteToNowActive=$clip." strikes left";
    }
    // no change
    return false;
  }
  
  static function loadClip($newActive,$g) {
    $strikeRule = json_decode( $g->rules, true ) ["strikeRule"];
    if ( $strikeRule=="oe" ) { 
      $clip=1;
      //$note="Make your move";
    }
    else if ( $strikeRule=="bs" ) {
      $fm = json_decode( $g->ships[$newActive], true );
      $clip = $fm["largest"];
      //$note="Make your move";
    }
    else throw new Exception ("Wrong strikeRule:".$strikeRule."!");
    //$g->clip = $clip;
    return $clip;
  }
}
?>