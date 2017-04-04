<?php

class Intro extends DetachableController {
  
  function go($act) {
    $input=$this->input;
    $cookie = & $this->cookie;
    $hc=$this->helperClass;
  
    $name=$side=$id=$otherSide="";
    $state="*";
    $r=null;

    list($db,$name,$side,$otherSide,$state,$g) = $hc::init($cookie,$input,"intro",$act);
    
    switch ($act) {

    case "register":

      if ( empty($input["playerName"]) || empty($input["playerName"]) ) {
        $r = $hc::fail("Missing name(s)");
        break;
      }
      // look for open deal records (with state=="connecting")
      $open = $db->findOpenByB($input["playerName"]);
      //echo("found record:".$open.".");
      if ( $open===false ) {
        $activeAB = $db->findActiveByAB ( $input["playerName"], $input["enemyName"] );
        $activeBA = $db->findActiveByAB ( $input["enemyName"], $input["playerName"] );
        if ($activeAB || $activeBA) {
          if ($activeAB && $activeBA) {
            $r = $hc::fail("There are two active games with these players");
            break;
          }
          if ($activeAB) { 
            $arr = $db->readGame($activeAB);
            $side="A";
          }
          else { 
            $arr = $db->readGame($activeBA);
            $side="B";
          }
          if ( !$arr ) {
            throw new Exception ("Something is wrong with record #".$open."!");
          }
          $g=new Game();
          $g->import($arr);
          $hc::setCookie($cookie,$input["playerName"],$side,$g->getId());
          // reply like to queryAll
          require_once("PlayHelper.php");
          $r = PlayHelper::fullInfo($side,$g);
          break; 
        }
        else {
          // new game
          $g=new Game();
          $this->inState = "zero";
          $pn=$input["playerName"];
          $g->setName("A",$pn);
          $g->setName("B",$input["enemyName"]);
          $g->setTimeInit();
          $g->setState("connecting");
          $g->setStage("intro");
          $g->setActive("A");
          $newId = $db->saveGame($g);
          if (!isset($input["reqId"])) {
            $hc::setCookie($cookie,$pn,"A",$newId);
          }
          $r = '{'.$g->exportPair( [/*"stage",*/"state","players"] ).'}';// stage is always added
          break;
        }
      }
      else {// open game found
        $arr = $db->readGame($open);
        if ( !$arr ) {
          throw new Exception ("Something is wrong with record #".$open."!");
        }
        if ( $arr["nA"]!==$input["enemyName"] ) {
          $r = $hc::fail("Wrong name:".$input["enemyName"].", did you mean ".$arr["nA"]." ?");
          break;
        }
        // registration to already open game
        $g=new Game();
        $g->import($arr);
        $state=$g->getState();
        $this->inState=$state;
        $g->setTimeConnected();
        if ($g->checkConverged()) $g->setState("converged");// default picks are equal
        else $g->setState("picking");
        $g->setStage("rules");
        $db->saveGame($g,true);
        if (!isset($input["reqId"])) {
          $hc::setCookie($cookie,$input["playerName"],"B",$g->getId());
        }
        $r = '{'.$g->exportPair( [/*"stage",*/"state","players"] ).'}';// stage is always added
        break;
      }

      throw new Exception ("Wrong state/command ".$state."/".$act."!");
      
    case "queryStage":
      $this->inState=$state;
      if ($state=="connecting") {
        $r=$hc::noteState("Waiting for ".$g->getName($g->getOtherSide($g->getActive())),$state);
        break;
      }
      $r=$hc::noteState("Going on",$state);
      break;
      
    case "abort":
      $this->inState=$state;
      if ( in_array ( $state, ["zero","finish"] ) ) {
        $r = '{"note":"No state change, only clearing cookie"}';
        break;
      }
      if ( in_array ( $state, ["picking","converged","confirming"] ) ) {
        $r = $hc::fail("An active state is not supposed to be aborted");
        break;
      }
      $g->setState("aborted");
      $g->setStage("aborted");
      $db->saveGame($g,true);
      $hc::clearCookies($cookie);
      $r = $hc::noteState("Session aborted by user, you may register again","intro");
      break;

    case "queryAll":
      $this->inState=$state;
      require_once ("PlayHelper.php");
      $r = PlayHelper::fullInfo($side,$g);
      break;
      
    default:
      $r = $hc::fail("Missing or invalid command:".$act."!", $state);
      break;
    }// end switch
    
    //var_dump($g);
    $db->destroy();
    if (isset($g) && is_object($g)) $resStage=$g->getStage();
    else $resStage="intro";
    $r = $hc::appendToJson( $r, '"stage":"'.$resStage.'"' );
    if (isset($g) && is_object($g)) $resState=$g->getState();
    else $resState="?";
    $this->outState=$resState;
    return $r;
  }
}

class Rules extends DetachableController {
   
  function go($act) {
    $input=$this->input;
    $cookie = & $this->cookie;
    $hc=$this->helperClass;
  
    $name=$side=$id=$otherSide="";
    $state="*";
    $r=null;
    
    list($db,$name,$side,$otherSide,$state,$g) = $hc::init($cookie,$input,"rules",$act);
    $this->inState=$state;
    
    switch ($act) {
      
    case "updPick":
      if (!$input["pick"]) {
        $r = $hc::fail("No data found");
        break;
      }
      if ( ! in_array ( $state, ["picking","converged","confirming"] ) ) {
        $r = '{"note":"No update allowed in the state '.$state.'"}';
        break;
      }
      $g->setPick($side,$input["pick"]);
      //echo("*".$input["pick"]." >".$g->getPick($side)."!");
      if ( $g->checkConverged() ) {
        $g->setState("converged");
      }
      else {
        $g->setState("picking");
        $g->clearActive();
      }
      $db->saveGame($g,true);
      //print_r($db->readGame($g->getId()));
      // return value same as queryPick
      $r='{"picks":{"'.$otherSide.'":'.$g->getPick($otherSide).'}}';
      $r=$hc::appendToJson($r,$g->exportPair(["state"]));
      break;
      
    case "confirm":
      if ( in_array ( $state, ["connecting","finish"] ) ) {
        $r = '{"note":"No confirmation allowed in the state '.$state.'"}';
        break;
      }
      if ( $state=="picking" ) {
        $r = $hc::fail("Answers are different or empty, go on bargaining", $state);
        break;
      }
      // sending rulesSet is compulsory
      if ( ! isset($input["rulesSet"]) ) {
        $r = $hc::fail("Missing input parameter rulesSet");
        break;
      }
      if ( $state=="converged" ) {
        if ( ! $g->checkConverged() ) throw new Exception("Non-equal picks in Converged stste");
        // sending picks with "confirm" is optional
        if ( isset($input["pick"]) ) {
          if ( $input["pick"] !== $g->getPick($side) ) {
            $r = $hc::fail("Given answers ".$input["pick"]." differ from the recorded ".$g->getPick($side)." !", $state);
            break;
          }
        }
        $parsedRules=json_decode($input["rulesSet"],true);// true to return assoc array, not object
        //var_dump($parsedRules);
        // page1.js Global::exportRules
        if (count($parsedRules)!=5) {
          $r = $hc::fail("Wrong size of Rules array:".count($parsedRules));
          break;
        }
        $g->rulesSet = $input["rulesSet"];
        
        $g->setActive($side);
        $state=$g->setState("confirming");
        $db->saveGame($g,true);
        //$r = '{'.$g->exportPair(["state"]).'}';
        $r = $hc::noteState("Wait for you opponent",$state);
        break;
      }
      if ( $state=="confirming" ) {
        if ( ! $g->checkConverged() ) throw new Exception("Non-equal picks in Confirming stste");
        if ( $g->isActive($side) ) {// Confirm from this side already received
          $r = $hc::noteState("Wait for you opponent",$state);
          break;
        }
        else {
          if ( $g->rulesSet !== $input["rulesSet"] ) {
            $r = $hc::fail('Value of Rules array is different from the already saved:"'.$input["rulesSet"].'"/"'.$g->rulesSet.'"');
            break;
          } 
          else {
            $parsedRules=json_decode($input["rulesSet"],true);
          }
          $state=$g->setState("ships");
          $g->setStage("ships");
          $db->saveGame($g,true);
          $r=$hc::noteState("Done! Now draw your ships",$state);
          // add picks ?
          break;
        }
      }
      throw new Exception ("Wrong state/command ".$state."/".$act."!");

    case "queryPick":
      if ( $state == "connecting" ) {
        $note='Waiting for another player '.$g->getName($otherSide);
        $r = $hc::noteState($note,$state);
        break;
      }
      // state noChange      
      $r='{"picks":{"'.$otherSide.'":'.$g->getPick($otherSide).'}}';// quotes around Pick make problems for FF
      $r=$hc::appendToJson($r,$g->exportPair(["state"]));
      if ( $state == "confirming" && $g->isActive($side) ) $r=$hc::appendToJson($r,'"note":"Waiting for '.$g->getName($otherSide).'"');
      if ( $state == "finish" ) $r=$hc::appendToJson($r,'"note":"Done!"');
      if ( $state == "aborted" ) $r=$hc::appendToJson($r,'"note":"Session aborted by user"');
      break;
      
    default:
      $r = $hc::fail("Missing or invalid command:".$act."!", $state);
      break;
    }// end switch
    
    $db->destroy();
    if (isset($g) && is_object($g)) $resStage=$g->getStage();
    else $resStage="?";
    $r = $hc::appendToJson( $r, '"stage":"'.$resStage.'"' );
    if (isset($g) && is_object($g)) $resState=$g->getState();
    else $resState="?";
    $this->outState=$resState;
    return $r;
  }
}

class Ships extends DetachableController {
   
  function go($act) {
    $input=$this->input;
    $cookie = & $this->cookie;
    $hc=$this->helperClass;
  
    $name=$side=$id=$otherSide="";
    $state="*";
    $r=null;
    
    list($db,$name,$side,$otherSide,$state,$g) = $hc::init($cookie,$input,"ships",$act);
    $this->inState=$state;
    
    switch ($act) {
    case "confirmShips":
      if ( ! isset($input["fleet"]) ) {
        $r = $hc::fail("Missing input parameter Fleet");
        break;
      }
      
      require_once("PlayHelper.php");
      $parsedRules=json_decode($g->rulesSet,true);
      $fleetModel=PlayHelper::validateFleet( $input["fleet"],$parsedRules );
      if (!is_array($fleetModel)) {
        $r = $hc::fail("Ships must be straight and not to touch each other. Try new ones.");
        break;      
      }
      if ( !is_array($parsedRules["forces"]) ) throw new Exception("Wrong parameter forces in rulesSet");
      if ( $parsedRules["demandEqualForces"] ) {
        if (! PlayHelper::validateForces($fleetModel,$parsedRules["forces"]) )  {
          $r = $hc::fail("Sizes of your ships do not comply with what is demanded by rules. Try new ones.");
          break;
        }
      }
      // finally OK
      $g->setShips($side,$fleetModel);
      if ($state=="ships") {
        $state=$g->setState("confirmingShips");
        $g->setActive($side);
        $db->saveGame($g,true);
        $r = $hc::noteState("Wait for your opponent ".$g->getName($otherSide),$g->getState());
        break;
      } 
      else if ($state=="confirmingShips" && $otherSide==$g->getActive()) {
        // done with ships, prepare the fighting stage
        $g->setStage("fight");
        $state=$g->setState("fight");
        // make statistics
        $stat = $g->getStats();
        PlayHelper::addToStats( $stat, $side, PlayHelper::makeFleetStat($fleetModel) );
        $otherFleetModel = $g->getShips($otherSide);
        PlayHelper::addToStats( $stat, $otherSide, PlayHelper::makeFleetStat($otherFleetModel) );
        $g->setStats($stat);
        
        // set active side and load clip
        $fa=$parsedRules["firstActiveAB"];
        //if ( $fa!="A" && $fa!="B" ) $r = $hc::fail("Invalid first move side:".$fa);
        $g->setActive($fa);
        PlayHelper::loadClip($fa,$g);        
        $db->saveGame($g,true);
        if ($side==$fa) $r = $hc::noteState("Make your move",$state);
        else $r = $hc::noteState("Enemy is striking first",$state);
        $r = $hc::appendToJson($r,$g->exportPair(["activeSide","stats"]));
        break;
      } 
      else if ($state=="confirmingShips" && $side==$g->getActive()) {
        $db->saveGame($g,true);
        $r = $hc::noteState("New ships accepted. Wait for your opponent",$state);
        break;
      }
      else if ($state=="fight") {
        if ($side == $g->getActive()) $note="Make your move";
        else $note="Enemy is striking first";
        $r = $hc::notePairs($note, $g, ["activeSide","state","stats"] );
        break;      
      }
      else { throw new Exception ("Something is wrong with stage/state/active"); }
      
    case "queryStage":
      if ($state=="fight") {
        if ($side == $g->getActive()) $note="Make your move";
        else $note="Enemy is striking first";
        $r = $hc::notePairs($note, $g, ["activeSide","state","stats"] );
        break;
      }
      else if ($state=="ships") {
        $note="Draw your ships, then press Done";      
      } 
      else if ($state=="confirmingShips" && $otherSide==$g->getActive()) {
        $note="Your opponent is ready and waiting for you";
      } 
      else if ($state=="confirmingShips" && $side==$g->getActive()) {
        $note="Wait for your opponent";      
      }
      else { 
        $r = $hc::fail ( "Something is wrong with stage/state/active :".$g->getStage()."/".$g->getState()."/".$g->getActive() ); 
        break;
      }
      $r = $hc::noteState($note,$state);
      break;
      
    default:
      $r = $hc::fail("Missing or invalid command:".$act."!", $state);
      break;
    }// end switch
    
    $db->destroy();
    if (isset($g) && is_object($g)) $resStage=$g->getStage();
    else $resStage="?";
    $r = $hc::appendToJson( $r, '"stage":"'.$resStage.'"' );
    if (isset($g) && is_object($g)) $resState=$g->getState();
    else $resState="?";
    $this->outState=$resState;
    return $r;
  }  
}// end class Ships

class Fight extends DetachableController {
   
  function go($act) {
    $input=$this->input;
    $cookie = & $this->cookie;
    $hc=$this->helperClass;
  
    $name=$side=$id=$otherSide="";
    $state="*";
    $r=null;
    $err=null;
    $note="";
    
    list($db,$name,$side,$otherSide,$state,$g) = $hc::init($cookie,$input,"rules",$act);
    $this->inState=$state;
    
    require_once("PlayHelper.php");
    
    switch ($act) {
    case "strike":
    
      // check inputs
      if (!$input["rc"] || !$input["thisMove"]) {
        $r = $hc::fail("Not enough data");
        break;
      }
      if ($side !== $g->getActive()) {
        $r = $hc::fail("Active side is ".$g->getActive());
        break;
      }
      if ( $input["thisMove"] != $g->getTotal()+1 ) {
        $r = $hc::fail("Moves count is ".$g->getTotal());
        break;
      }
      $point=json_decode($input["rc"]);
      $valid0 = $point[0]===0 || ( $point[0]>=1 && $point[0]<=9 );
      $valid1 = $point[1]===0 || ( $point[1]>=1 && $point[1]<=9 );
      if (!$valid0 || !$valid1)  {
        $r = $hc::fail("Invalid row or column in ".$input["rc"]);
        break;
      }
      
      // get response from Model
      $sunk = null;
      $fleetModel = $g->getShips($otherSide);
      $hit = PlayHelper::checkHit($point,$fleetModel);
      
      if (is_array($hit)) {
        $sunk = $hit;//$sunk = json_encode($hit);
        $hit="w";
        if ( PlayHelper::checkAllSunk($fleetModel) ) { 
          $hit="f";
          $g->setStage("finish");
          $g->setState("finish");
          $g->winner = $g->getActive();
          //echo($g->getActive()." has won ");
          $g->setTimeFinished();
        }
      }
      
      // update statistics 
      $g->incTotal();
      $g->decClip();
      $newFleetStat = PlayHelper::makeFleetStat($fleetModel);
      $statObj=$g->getStats();
      $newStrikesStat = PlayHelper::makeStrikesStat($hit,$side,$statObj);
      PlayHelper::addToStats($statObj,$otherSide,$newFleetStat);
      PlayHelper::addToStats($statObj,$side,$newStrikesStat);
      //var_dump($statObj);
      $g->setStats($statObj);
      
      // define new active side and message to sending side
      $handover=PlayHelper::defineActive($hit,$g,$note);

      // prepare data and save them
      $moveSum = PlayHelper::encodeMove ( $g->getTotal(), $side, $point, $hit, $sunk );
      $g->addMove($moveSum);
      if ( in_array($hit,["h","w","f"]) ) {
        $g->setShips($otherSide,$fleetModel);  
      }
      $db->saveGame($g,true);
      
      // make response   
      $r = '{"move":'.$moveSum.',"note":"'.$note.'"}';
      $r = $hc::appendToJson( $r, $g->exportPair(["activeSide","clip","stats"]) );
      if ( $g->getState() == "finish" ) {
        $r = $hc::appendToJson( $r, $g->exportPair(["winner","state"]) );
      }
      break;
      
    case "queryMoves":
      $now=$g->getTotal();
      if ( !isset( $input["latest"] ) ) {
        $r = $hc::fail("Missing argument Latest");
        break;      
      }
      $latest=$input["latest"];
      if ( $input["latest"] > $now ) {
        $r = $hc::fail("Wrong argument Latest:".$latest."!");
        break;      
      }
      if ( $latest == $now ) {
        if ( $side == $g->getActive() ) {
          $r = $hc::fail("Your are expected of strikes, not queries");
          break;         
        } 
        //$r = '{'.$g->exportPair(["state","activeAB","clip"]).'}';
        $r = $hc::noteState($g->getName($g->getActive())." is thinking",$state);
        break;
      }
      $freshMoves=[];
      $movesArr=$g->getMoves();
      //print_r($movesArr);

      if (count($movesArr) != $now ) throw new Exception ( "There are ".count($movesArr)." moves recorded, but Total=".$now );
      for ( $i=$latest; $i<$now; $i++ ) {
        $freshMoves [] = $movesArr [$i];
      }
      $freshMovesJson=json_encode($freshMoves);
      if ( $g->getStage() == "finish" ) {
        if ( $g->winner == $side ) $note="You have won";
        else $note="<span class='lose'>ENEMY HAS WON !</span>";
      }
      else {
        if ( $g->isActive($side) ) $note="Make your move";
        else $note="Enemy is still striking";
      }
      $r = $hc::noteState($note,$state);
      $r = $hc::appendToJson( $r, '"moves":'.$freshMovesJson );
      $r = $hc::appendToJson( $r, $g->exportPair(["stats","activeSide","clip"]) );
      if ($g->winner) $r = $hc::appendToJson( $r, $g->exportPair(["winner"]) );
      break;
   
    default:
      $r = $hc::fail("Missing or invalid command:".$act."!", $state);
      break;
    }// end switch
    
    $db->destroy();
    if (isset($g) && is_object($g)) $resStage=$g->getStage();
    else $resStage="?";
    $r = $hc::appendToJson( $r, '"stage":"'.$resStage.'"' );
    if (isset($g) && is_object($g)) $resState=$g->getState();
    else $resState="?";
    $this->outState=$resState;
    return $r;
  }
}// end class Fight

class Finish extends DetachableController {
   
  function go($act) {
    $input=$this->input;
    $cookie = & $this->cookie;
    $hc=$this->helperClass;
  
    $name=$side=$id=$otherSide="";
    $state="*";
    $r=null;
    $err=null;
    $note="";
    
    list($db,$name,$side,$otherSide,$state,$g) = $hc::init($cookie,$input,"finish",$act);
    $this->inState=$state;
    
    require_once("PlayHelper.php");
    
    switch ($act) {
    case "more":
      if ($state == "finish") {
      $state = $g->setState("cyclingReq");
      $g->setActive($side);
      $db->saveGame($g,true);
      $r=$hc::notePairs( "Wait for your opponent", $g, ["state","activeSide"] );
      break;
      }
      else if ($state == "cyclingReq" && $side != $g->getActive() ) {
        //$ng = clone $g; does not copy inner strings
        $ng=new Game();
        $ng->import($g->export());
        $ng->recycle();
        $ng->addToRulesSet("firstActiveAB",$g->winner);
        //echo (" added ".$g->winner);
        $r=PlayHelper::fullInfo($side,$ng);
        $newId = $db->saveGame($ng,false);
        if (!isset($input["reqId"])) {
          $hc::setCookie($cookie,$ng->getName($side),$side,$newId);
        }
        $g->setState("cyclingOk");
        $db->saveGame($g,true);
        $g->setStage($ng->getStage());
        break;
      }
      else if ($state == "cyclingOk") {
        $newId = $db->findActiveByAB($g->getName("A"),$g->getName("B"));
        if (!$newId) {
          $r=$hc::fail("No reopened game found, try to register again");
          break;
        }
        $ngArr=$db->readGame($newId);
        $ng = new Game;
        $ng->import($ngArr);
        $r=PlayHelper::fullInfo($side,$ng);
        if (!isset($input["reqId"])) {
          $hc::setCookie($cookie,$ng->getName($side),$side,$newId);
        }
        $g->setStage($ng->getStage());
        break;
      }
      else if ($state == "leaving") {
        $hc::clearCookies($cookie);
        $r=$hc::noteState("Please, register again","intro");
        $g->setStage("intro"); // just to pass the stage=intro to output
        break;  
      }
      throw new Exception ("Wrong state/command ".$state."/".$act."!");
      
    case "new":
      $hc::clearCookies($cookie);
      $r=$hc::noteState("Please, register again","intro");
      $g->setState("leaving");
      $db->saveGame($g,true);
      $g->setStage("intro"); // just to pass the stage=intro to output
      break;
      
    case "queryStage":
      if ($state == "cyclingOk") {
        $newId = $db->findActiveByAB($g->getName("A"),$g->getName("B"));
        if (!$newId) {
          $r=$hc::fail("No reopened game found, try to register again");
          break;
        }
        $ngArr=$db->readGame($newId);
        $ng = new Game;
        $ng->import($ngArr);
        $r=PlayHelper::fullInfo($side,$ng);
        $hc::setCookie($cookie,$ng->getName($side),$side,$newId);
        $g->setStage($ng->getStage());
        break;
      }
      else if ($state == "leaving") {
        $hc::clearCookies($cookie);
        $r=$hc::noteState("Please, register again","intro");
        $g->setStage("intro"); // just to pass the stage=intro to output
        break;  
      }
      $r=$hc::noteState("Still waiting",$state);
      break;
    
    default:
      $r = $hc::fail("Missing or invalid command:".$act."!", $state);
      break;
    }// end switch
    
    $db->destroy();
    if (isset($g) && is_object($g)) $resStage=$g->getStage();
    else $resStage="?";
    $r = $hc::appendToJson( $r, '"stage":"'.$resStage.'"' );
    if (isset($g) && is_object($g)) $resState=$g->getState();
    else $resState="?";
    $this->outState=$resState;
    return $r;
  }
}// end class Finish

class Adm extends DetachableController {
   
  function go($act) {
    $input=$this->input;
    $cookie = & $this->cookie;
    $hc=$this->helperClass;
  
    $name=$side=$id=$otherSide="";
    $state="*";
    $r="{}";
    $err=null;
    $note="";

    list($db,$name,$side,$otherSide,$state,$g) = $hc::init($cookie,$input,"adm",$act);
    $this->inState=$state;
    
    require_once("PlayHelper.php");
    
    switch ($act) {
    case "dumpShips":
      $shA=$g->getShips("A");
      $shB=$g->getShips("B");
      print($g->getName("A")."<br />\n");
      print_r ($shA);
      print("<br />\n".$g->getName("B")."<br />\n");
      print_r ($shB);
      break;
      
    case "dumpPage":
      echo("cookie:");
      print_r($cookie);
      echo("<br />name=".$name." side=".$side." otherSide=".$otherSide." state=".$state);
      echo("<br />game:");
      print_r($g->export());
      break;
    
    case "rmDb":
      $dbfile="game.db";
      if (!file_exists($dbfile)) {
        $r = $hc::fail("Db not found:".$dbfile."!", $state);
      }
      else {
        try { $db->destroy(); } catch (Exception $err) { echo("No connection found\n"); }
        unlink($dbfile);
        $r = $hc::noteState($dbfile." deleted", $state);
      }
      break;
    
    default:
      $r = $hc::fail("Missing or invalid command:".$act."!", $state);
      break;
    }// end switch
    
    if (isset($g) && is_object($g)) $resStage=$g->getStage();
    else $resStage="?";
    $r = $hc::appendToJson( $r, '"stage":"'.$resStage.'"' );
    if (isset($g) && is_object($g)) $resState=$g->getState();
    else $resState="?";
    $this->outState=$resState;
    return $r;
  }
}// end class Adm    
?>