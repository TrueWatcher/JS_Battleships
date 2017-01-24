<?php

class PlayHelper {
  
  static function adjAll($row,$col,$max) {
  // arrayUtils.js adjAll
    if (!$max) $max=10;
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
  
  static function around ($pointsArray) {
  // arrayUtils.js around
    if ( !is_array($pointsArray) throw new Exception ("Usage error! Non-array or single-dimension array passed to 'around()' ");
      //return false;
    }
    $res=[];
    $adjacent=[];
    //var rc,rca;
    for ($i=0;$i<count($pointsArray);$i++) {
      $rc=$pointsArray[$i];
      /*if (mode=="cross") adjacent=adjCross(rc[0],rc[1]);
      else*/
      $adjacent=self::adjAll($rc[0],$rc[1]);
      for ($j=0;$j<$count($adjacent);$j++) {
        $rca=$adjacent[$j];
        if ( !in_array($rca,$pointsArray) && !in_array($rca,$res) ) $res[]=$rca;
      }
    }
    return($res);
  }
  
  static function validateShips($shipsJson) {
  // Fleet::checkMargins
    $shipsArr=json_decode($shipsJson);
    $shipsStore=[];
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
    // validated successfully, addind metadata
    foreach ($shipsArray as $ship) {
      $modShip=[];
      foreach ($ship as $rc) { $modShip[]=["rc"=>$rc,"h"=>0] }
      $shipsStore[]=["ship"=>$modShip,"killed"=>0];
    }
    return $shipsStore;
  }
  
  static function checkHit($point,&$shipsStore) {
    if (!is_array($point) || count($point)!=2) throw new Exception ("Invalid point");
    $hit="";
    foreach ($shipStore as &$shipObj) {
      $ship=&$shipObj["ship"];
      $status=&$shipObj["killed"];
      $wounds=0;
      foreach ($ship as &$pointObj) {
        $decks=count($ship);
        $rc=$pointObj["rc"];
        $collides= ( implode($rc,",") == implode($point,",") );
        $h=$pointObj["h"];
        if ($h) { 
          $wounds++;
          if ($collides) return ("n");// hit on already hit point
        }
        else if ($collides) {
          $wounds++;
          $h=1;
          $hit="h";
          break;
        }
      }
      if ($hit) {
        if ($wounds==$decks) {
          $status=1;
          return ("k");
        }
        else { return("h"); }
      }
    }
    return ("m");
  }
  
  static function checkAllKilled($shipsStore) {
    foreach ($shipStore as $shipObj) {
      $status=$shipObj["killed"];
      if (!$status) return false;
    }
    return true;
  }
}
?>