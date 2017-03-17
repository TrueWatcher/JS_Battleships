<?php
// The server part of Battleships game.
// By TrueWatcher, Jan 2016
// v.0.0.3 decoupled HubManager from input and cookie, added trace
//   0.0.4 fixed '"{\"' in Game::exportPair
//   0.0.5 refactoring: new classes Intro and Rules 
//   0.0.6 minimal unit tests
//   2.0.4 add stage Ships


require_once("Game.php");
/**
 * Allows for calling controller with mock input and cookie arrays.
 */
abstract class DetachableController {
  protected $input;
  protected $cookie;
  protected $helperClass;
  public $inState="*";
  public $outState="*";
  public $act=null;
  
  function __construct($input=null,&$cookie=null,$hc="HubHelper") {
    if( !isset($input) ) $this->input = $_REQUEST;
    else $this->input = $input;
    if( !isset($cookie) ) $this->cookie = & $_COOKIE;
    else $this->cookie = &$cookie;
    $this->helperClass = $hc;
  }
  
  abstract function go($action);
}

/**
 * The outermost controller.
 * Resolves game stage, instantiates and calls the appropriate subcontroller.
 * Also manages trace for debugging.
 */
class HubManager extends DetachableController {

  public $trace="";
  public $act="";
  
  function track($subj) {
    $separator=">";
    if (!is_array($subj)) $subj=[$subj];
    foreach ($subj as $str) {
      if ( $str===false ) $str="false";
      if (!$str) $str="null";
      $this->trace.=$separator.$str;
    }
  }

  public static $stageClasses=["intro"=>"Intro", "rules"=>"Rules", "ships"=>"Ships", "fight"=>"Fight", "finish"=>"Finish", "adm"=>"Adm"];
  
  function go($action) {
    $input=$this->input;
    $cookie = & $this->cookie;
    $hc=$this->helperClass;
  
    $name=$side=$id="";
    $stage="";
    $state="*";
    $r=null;
    
    $stage=$hc::detectStage($input);
    if ( !$stage ) {
      $r=$hc::fail("Invalid input","zero");
      $this->track( [ $state, $state, $hc::collectKeys2($r) ] );
      $r=$hc::appendToJson($r,'"trace":"'.$this->trace.'"');
      return($r);
    }
    $sc = self::$stageClasses [$stage];
    $stageController = new  $sc($input,$cookie,$hc);
    if ( isset($input[$stage]) ) {
      $this->act = $input[$stage];
    }
    
    $r = $stageController->go($this->act);
    
    //$r=$hc::appendToJson($r,'"stage":"'.$this->stage.'"');
    $this->track( [ $stage, $stageController->inState, $this->act, $stageController->outState, $hc::collectKeys2($r) ] );
    $r=$hc::appendToJson($r,'"trace":"'.$this->trace.'"');
    return($r);    
  }
}// end HubManager

class Intro extends DetachableController {
  
  function go($act) {
    $input=$this->input;
    $cookie = & $this->cookie;
    $hc=$this->helperClass;
  
    $junk=null;
    $name=$side=$id=$otherSide="";
    $state="*";
    $r=null;

    //print_r($cookie);
    $db=new RelaySqlt(true);
    
    switch ($act) {
    case "register":
      //$cookiePresent=$hc::readCookie($cookie,$junk,$junk,$junk);
      //if (!$cookiePresent) { 
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
              $r = $hc::fail("There are two active games with this players");
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
            $hc::setCookie($cookie,$pn,"A",$newId);
            $r = '{'.$g->exportPair( ["stage","state","players"] ).'}';
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
          $hc::setCookie($cookie,$input["playerName"],"B",$g->getId());
          $r = '{'.$g->exportPair( ["stage","state","players"] ).'}';
          break;
        }
      //}
      //else {
      //  $r = $hc::fail("You are already registered");
      //  break;
      //}
      throw new Exception ("Wrong state/command ".$state."/".$act."!");
      
    case "queryStage":
      if ( 3 != $hc::readCookie($cookie,$name,$side,$id) ) {
        $r = $hc::fail("Please, register");
        break;
      }
      $g=$hc::findRecord($db,$name,$side,$id);
      $state=$g->getState();
      $this->inState=$state;
      if ($state=="connecting") {
        $r=$hc::noteState("Waiting for ".$g->getName($g->getOtherSide($g->getActive())),$state);
        break;
      }
      $r=$hc::noteState("Going on",$state);
      break;
      
    case "abort":
      if ( 3 != $hc::readCookie($cookie,$name,$side,$id) ) {
        $r = $hc::fail("Please, register");
        break;
      }
      $g=$hc::findRecord($db,$name,$side,$id);
      $state=$g->getState();
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
      //echo(">queryAll");
      if ( 3 != $hc::readCookie($cookie,$name,$side,$id) ) {
        $r = $hc::noteState("Brand new session","intro");
        break;
      }
      $otherSide=Game::getOtherSide($side);
      $g=$hc::findRecord($db,$name,$side,$id);
      $state=$g->getState();
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

    //print_r($cookie);
    
    $db=new RelaySqlt(true);
    
    if ( 3 != $hc::readCookie($cookie,$name,$side,$id) ) {
      $r = $hc::fail("Please, register");
      break;
    }
    $otherSide=Game::getOtherSide($side);
    $g=$hc::findRecord($db,$name,$side,$id);
    $state=$g->getState();
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
        $r = '{'.$g->exportPair(["state"]).'}';
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

    //print_r($cookie);
    
    $db=new RelaySqlt(true);
    
    if ( 3 != $hc::readCookie($cookie,$name,$side,$id) ) {
      $r = $hc::fail("Please, register");
      break;
    }
    $otherSide=Game::getOtherSide($side);
    $g=$hc::findRecord($db,$name,$side,$id);
    $state=$g->getState();
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
      $g->ships[$side] = json_encode($fleetModel);
      if ($state=="ships") {
        $state=$g->setState("confirmingShips");
        $g->setActive($side);
        $db->saveGame($g,true);
        $r = $hc::noteState("Wait for your opponent ".$g->getName($otherSide),$g->getState());
        break;
      } 
      else if ($state=="confirmingShips" && $otherSide==$g->getActive()) {
        $g->setStage("fight");
        $state=$g->setState("fight");
        // make statistics
        $stat = json_decode($g->stats,true);
        PlayHelper::addToStats( $stat, $side, PlayHelper::makeFleetStat($fleetModel) );
        $otherFleetModel = json_decode($g->ships[$otherSide] , true);
        if (!is_array($otherFleetModel)) throw new Exception ("Failed to decode ships from ".$otherSide);
        PlayHelper::addToStats( $stat, $otherSide, PlayHelper::makeFleetStat($otherFleetModel) );
        $g->stats = json_encode($stat);
        
        // set active side and load clip
        $fa=$parsedRules["firstActiveAB"];
        //if ( $fa!="A" && $fa!="B" ) $r = $hc::fail("Invalid first move side:".$fa);
        $g->setActive($fa);
        $g->setClip ( PlayHelper::loadClip($fa,$g) );        
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
        $r = $hc::notePairs($note, $g, ["activeSide","state"] );
        break;      
      }
      else { throw new Exception ("Something is wrong with stage/state/active"); }
      
    case "queryStage":
      if ($state=="fight") {
        if ($side == $g->getActive()) $note="Make your move";
        else $note="Enemy is striking first";
        $r = $hc::notePairs($note, $g, ["activeSide","state"] );
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

    //print_r($cookie);
    
    $db=new RelaySqlt(true);
    
    if ( 3 != $hc::readCookie($cookie,$name,$side,$id) ) {
      $r = $hc::fail("Please, register");
      break;
    }
    $otherSide=Game::getOtherSide($side);
    $g=$hc::findRecord($db,$name,$side,$id);
    $state=$g->getState();
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
      $fleetModel = json_decode ($g->ships[$otherSide],true);
      if (!is_array($fleetModel)) throw new Exception ("Failed to decode fleet from ".$g->ships[$otherSide]);
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
      $statObj=json_decode($g->stats,true);
      if (!is_array($statObj)) throw new Exception ("Failed to decode statictics from ".$g->stats);
      $newStrikesStat = PlayHelper::makeStrikesStat($hit,$side,$statObj);
      PlayHelper::addToStats($statObj,$otherSide,$newFleetStat);
      PlayHelper::addToStats($statObj,$side,$newStrikesStat);
      //var_dump($statObj);
      $g->stats = json_encode($statObj);
      
      // define new active side and message to sending side
      $handover=PlayHelper::defineActive($hit,$g,$note);

      // prepare data and save them
      $moveSum = PlayHelper::encodeMove ( $g->getTotal(), $side, $point, $hit, $sunk );
      $g->moves = $hc::appendToJson ( $g->moves, $moveSum );
      if ( in_array($hit,["h","w","f"]) ) {
        $g->ships[$otherSide] = json_encode($fleetModel);  
      }
      $db->saveGame($g,true);
      
      // make response   
      $r = '{"move":'.$moveSum.',"note":"'.$note.'"}';
      $r = $hc::appendToJson( $r, $g->exportPair(["activeSide","clip","stats"]) );
      if ($g->winner) $r = $hc::appendToJson( $r, $g->exportPair(["winner"]) );
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
      $moves=$g->moves;
      $movesArr=json_decode($moves);
      if (!is_array($movesArr)) throw new Exception ("Failed to decode moves from ".$moves);
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

    //print_r($cookie);
    
    $db=new RelaySqlt(true);
    
    if ( 3 != $hc::readCookie($cookie,$name,$side,$id) ) {
      $r = $hc::fail("Please, register");
      break;
    }
    $otherSide=Game::getOtherSide($side);
    $g=$hc::findRecord($db,$name,$side,$id);
    $state=$g->getState();
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
        $hc::setCookie($cookie,$ng->getName($side),$side,$newId);
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
    $r=null;
    $err=null;
    $note="";

    //print_r($cookie);
    
    $db=new RelaySqlt(true);
    
    if ( 3 != $hc::readCookie($cookie,$name,$side,$id) ) {
      $r = $hc::fail("Please, register");
      break;
    }
    $otherSide=Game::getOtherSide($side);
    $g=$hc::findRecord($db,$name,$side,$id);
    $state=$g->getState();
    $this->inState=$state;
    
    require_once("PlayHelper.php");
    
    switch ($act) {
    case "dumpShips":
      $shA=$g->ships["A"];
      $shB=$g->ships["B"];
      print($g->getName("A")."<br />\n");
      print_r ($shA);
      print("<br />\n".$g->getName("B")."<br />\n");
      print_r ($shB);
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
    
    
class HubHelper {

  static function detectStage($input) {
    //$lookup=["intro","rules","ships","play","adm"];
    $lookup=array_keys(HubManager::$stageClasses);
    foreach($lookup as $k) {
      if (array_key_exists($k,$input)) return $k;
    }
    return false;
  }

  static function readCookie($cookie,&$name,&$side,&$dealId) {
    if (empty($cookie)) return false;
    $name=$letter=$dealId="";
    $i=0;
    if ( isset($cookie["name"]) ) {
      $name=$cookie["name"];
      $i++;
    }
    if ( isset($cookie["side"]) ) {
      $side=$cookie["side"];
      $i++;
    }
    if ( isset($cookie["dealId"]) ) {
      $dealId=$cookie["dealId"];
      $i++;
    }
    return $i;
  }
  
  static function clearCookies(&$cookie) {
    setcookie("name","",time()-1000);
    setcookie("side","",time()-1000);
    setcookie("dealId","",time()-1000);
  }
  
  static function setCookie(&$cookie,$name,$side,$dealId) {
    setcookie("name",$name);
    setcookie("side",$side);
    setcookie("dealId",$dealId);
  }
  
  static function fail($note,$state=null) {
    $r='{"error":1,"note":"'.$note.'"}';
    if ($state) self::appendToJson($r,'"state":'.$state);
    return($r);
  }
  
  static function noteState($note,$state) {
    $r='{"state":"'.$state.'","note":"'.$note.'"}';
    return $r;
  }
  
  static function notePairs($note,Game $g, $keys) {
    $r='{"note":"'.$note.'",'.$g->exportPair($keys).'}';
    return $r;
  }
  
  /**
   *
   * @return {object Game}
   */
  static function findRecord($db,$name,$side,$id) {
    $rec=$db->readGame($id);
    if (!$rec) throw new Exception("Wrong id:".$id."!");//return (false);
    $g=new Game();
    if (! in_array($side,Game::$sides) ) throw new Exception("Wrong side:".$side."!");
    $g->import($rec);
    if ( $name !== $g->getName($side) ) throw new Exception("Name ".$name." and id ".$id." don't match");
    return($g);
  }
  
  static function appendToJson($json,$pair) {
    $l=strlen($json);
    if ($l<2) throw new Exception ("Too small JSON argument :".$json."!");
    $last=substr($json,$l-1,1);
    if ( $last!="}" && $last!="]" ) throw new Exception ("Invalid JSON argument termination :".$last."!");
    if ($l>2) { $r=substr($json,0,$l-1).",".$pair.$last; }
    else { $r=substr($json,0,1).$pair.$last; };
    return $r;
  }
  
  /**
   * Collects keys from upper and next levels.
   * @return string
   */
  static function collectKeys2($json,$separator="_") {
    $keys=[];
    //echo("==".$json."==");
    $obj=json_decode($json,true);
    //var_dump($obj);
    foreach( $obj as $k1=>$v1 ) {
      $keys[]=$k1;
      if ( is_array($v1) || is_object($v1) ) {
        foreach ( $v1 as $k2=>$v2 ) {
          $keys[]=$k2;
        }
      }
    }
    return (implode($separator,$keys));
  }
}

class DetachedHubHelper extends HubHelper {
  static function setCookie(&$cookie,$name,$side,$dealId) {
    $cookie["name"]=$name;
    $cookie["side"]=$side;
    $cookie["dealId"]=$dealId;
  }
  
  static function clearCookies(&$cookie) {
    $cookie = [];
  }
} 
/**
 * A container for database handler.
 */
class RelayDb {

  protected static $relayDbo=null;// DB handler

  protected function __construct($relayDbFile,$allowCreate) {
    if (! is_null(self::$relayDbo) ) {
      throw new Exception ("You are supposed to have only one instance of RelayDb class");
      //return(0);
    }
    self::$relayDbo = new SQLite3($relayDbFile,SQLITE3_OPEN_CREATE|SQLITE3_OPEN_READWRITE);
    self::$relayDbo -> busyTimeout(5000); // required for concurrency
  }
}// end forumDb

/**
 * Transaction script
 */
class RelaySqlt extends RelayDb {
  
  protected static $table="game";

  function __construct($allowCreate=false,$tableName=null) {
    $relayName="game";
    $path="";// relative to /thread/index.php
    $relayDbFile=$path.$relayName.".db";
    if( !empty($tableName) ) self::$table=$tableName;

    if (! file_exists($relayDbFile) ) {
      if (! $allowCreate) { // alas
        throw new Exception ("Missing or inaccessible database file : ".$relayDbFile);
      }
      else { // try to create new database
        touch($relayDbFile);
        if (! file_exists($relayDbFile) ) { // failed to create file
          throw new Exception ("Cannot create new database file : ".$relayDbFile.", check the folder permissions");
        }
      }
      // new db file was created
      parent::__construct($relayDbFile,true);
      $this->createTable(self::$table);
    }
    else {
    // db file was found ready
      parent::__construct($relayDbFile,false);
    }
  }
  
  function destroy() {
    if (parent::$relayDbo) parent::$relayDbo->close();
    parent::$relayDbo=null;
  }

  public function createTable($tableName) {
    // AUTOINCREMENT with PRIMARY KEY prevent the reuse of ROWIDs from previously deleted rows.
    // https://www.sqlite.org/autoinc.html
    $qCreateTable="CREATE TABLE '".$tableName."' (
      id INTEGER PRIMARY KEY,
      nA TEXT,
      nB TEXT,
      ti TEXT,
      tc TEXT,
      tf TEXT,
      af TEXT,
      stage TEXT,
      state TEXT,
      acs TEXT,
      pA TEXT,
      pB TEXT,
      rl TEXT,
      sA TEXT,
      sB TEXT,
      ms TEXT,
      st TEXT,
      cl TEXT,
      mt TEXT,
      wi TEXT
    )";
    //       mA TEXT,  mB TEXT,
    $ret = parent::$relayDbo->exec($qCreateTable);
    //echo(">".$ret);
  }

  protected static $dbKeys=["nA", "nB", "ti", "tc", "tf", "af", "stage", "state", "acs", "pA", "pB", "rl", "sA", "sB",/* "mA", "mB", */"ms", "st", "cl", "mt", "wi"];
  
  public function saveGame(Game $g,$overwrite=false) {
    $arr=$g->export();
    $dealDbKeys=array_keys($arr);
    $diff1=array_diff(self::$dbKeys,$dealDbKeys);
    $diff2=array_diff($dealDbKeys,self::$dbKeys);// must be ["id"]
    if ( !empty($diff1) ) throw new Exception ("Key missing from object:".implode(",",$diff1)); 
    if ( count($diff2)>1 ) throw new Exception ("Key missing from db:".implode(",",$diff2));
    $qAdd="INSERT INTO '".self::$table."' (";
    $qAdd.=implode(", ",self::$dbKeys);
    $qAdd.=") VALUES ( ";
    $qAdd.=":".implode(", :",self::$dbKeys);
    $qAdd.=")";
    
    $qUpd="UPDATE '".self::$table."' SET ";
    $pairs=[];
    foreach (self::$dbKeys as $k) {
      $pairs[]= $k."=:".$k;
    }
    $qUpd.=implode(", ",$pairs);
    $qUpd.=" WHERE id=:id";
    
    if (!$overwrite) $stmt=parent::$relayDbo->prepare($qAdd);
    else {
      $stmt=parent::$relayDbo->prepare($qUpd);
      $stmt->bindValue( ':id', $arr["id"], SQLITE3_INTEGER );
    }
    foreach (self::$dbKeys as $k) {
      $stmt->bindValue( ':'.$k, $arr[$k], SQLITE3_TEXT );
    }
    $stmt->execute();
    return( parent::$relayDbo->lastInsertRowID() );
  }
  
  function readGame($id) {
    $qRead="SELECT ";
    $qRead.="id, ".implode(", ",self::$dbKeys);
    $qRead.=" FROM '".self::$table."' WHERE id=:id";
    $stmt=parent::$relayDbo->prepare($qRead);
    $stmt->bindValue(':id',$id,SQLITE3_INTEGER);
    $result = $stmt->execute();
    $arr=$result->fetchArray(SQLITE3_ASSOC);
    return($arr);
  }
  
  function findOpenByB($nameB) {
    $qFindOpenB="SELECT id FROM '".self::$table."' WHERE state='connecting' AND ( nB=:nB )";// OR nA=;nA)
    $stmt=parent::$relayDbo->prepare($qFindOpenB);
    $stmt->bindValue(':nB',$nameB,SQLITE3_TEXT);
    $result = $stmt->execute();
    $found = $result->fetchArray();
    if (!$found) return false;
    return($found[0]);
  }
  
  function findActiveByAB($nameA,$nameB) {
    $qFindActiveAB="SELECT id FROM '".self::$table."' WHERE (stage<>'finish') AND (stage <>'aborted') AND state<>'finish' AND state<>'aborted'  AND nA=:nA AND nB=:nB"; 
    $stmt=parent::$relayDbo->prepare($qFindActiveAB);
    $stmt->bindValue(':nA',$nameA,SQLITE3_TEXT);
    $stmt->bindValue(':nB',$nameB,SQLITE3_TEXT);
    $result = $stmt->execute();
    $found = $result->fetchArray();
    if (!$found) return false;
    return($found[0]);
  }
  
  function kill($id) {
    $qKill="UPDATE '".self::$table."' SET state='aborted' WHERE id=:id";
    $stmt=parent::$relayDbo->prepare($qKill);
    $stmt->bindValue(':id',$id,SQLITE3_INTEGER);
    $result = $stmt->execute();
  }

}// end RelaySqlt

// MAIN

$controller=new HubManager();
$ret=$controller->go(null);
//echo("Trace:".$controller->trace);
print($ret);

?>