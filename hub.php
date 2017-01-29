<?php
// The server part of Battleships game.
// By TrueWatcher, Jan 2016
// v.0.0.3 decoupled HubManager from input and cookie, added trace
//   0.0.4 fixed '"{\"' in Game::exportPair
//   0.0.5 refactoring: new classes Intro and Rules 
//   0.0.6 minimal unit tests
//   2.0.4 add stage Ships

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

  public static $stageClasses=["intro"=>"Intro", "rules"=>"Rules", "ships"=>"Ships", "fight"=>"Fight", "adm"=>"Adm"];
  
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
            if ($activeAB) $arr = $db->readGame($activeAB);
            else $arr = $db->readGame($activeBA);
            if ( !$arr ) {
              throw new Exception ("Something is wrong with record #".$open."!");
            }
            $g=new Game();
            $g->import($arr);
            if ($activeAB) { $hc::setCookie($cookie,$input["playerName"],"A",$g->getId()); }
            else { $hc::setCookie($cookie,$input["playerName"],"B",$g->getId()); }
            // reply like to queryAll
            require_once("PlayHelper.php");
            $r = PlayHelper::fullInfo($side,$g);
            break; 
          }
          else {
            $g=new Game();
            $this->inState = "zero";
            $pn=$input["playerName"];
            $g->setName("A",$pn);
            $g->setName("B",$input["enemyName"]);
            $g->setTimeInit();
            $g->setState("connecting");
            $g->setStage("intro");
            $newId = $db->saveGame($g);
            $hc::setCookie($cookie,$pn,"A",$newId);
            $r = '{'.$g->exportPair( ["stage","state","players"] ).'}';
            break;
          }
        }
        else {
          $arr = $db->readGame($open);
          if ( !$arr ) {
            throw new Exception ("Something is wrong with record #".$open."!");
          }
          if ( $arr["nA"]!==$input["enemyName"] ) {
            $r = $hc::fail("Wrong name:".$input["enemyName"].", did you mean ".$arr["nA"]." ?");
            break;
          }
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
      $r = $hc::noteState("Session aborted by user","aborted");
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
      if ( $state=="converged" ) {
        if ( ! $g->checkConverged() ) throw new Exception("Non-equal picks in Converged stste");
        if ( isset($input["pick"]) ) {
          if ( $input["pick"] !== $g->getPick($side) ) {
            $r = $hc::fail("Given answers ".$input["pick"]." differ from the recorded ".$g->getPick($side)." !", $state);
            break;
          }
        }
        $g->setActive($side);
        $g->setState("confirming");
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
          $g->setState("ships");
          $g->setStage("ships");
          $db->saveGame($g,true);
          $r=$hc::noteState("Done! Now draw your ships",$state);
          // add picks ?
          break;
        }
      }
      throw new Exception ("Wrong state/command ".$state."/".$act."!");

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
      if (!isset($input["rulesSet"]) || !isset($input["fleet"])) {
        $r = $hc::fail("Missing input parameters");
        break;
      }
      // page1.js Global::exportRules
      if ($g->rules==="{}") {
        $parsedRules=json_decode($input["rulesSet"],true);// true to return assoc array, not object
        //var_dump($parsedRules);
        // page1.js Global::exportRules
        if (count($parsedRules)!=5) {
          $r = $hc::fail("Wrong size of Rules array:".count($parsedRules));
          break;
        }
        $g->rules = $input["rulesSet"];
      }
      else {
        if ( $g->rules !== $input["rulesSet"] ) {
          $r = $hc::fail("Value of Rules array is different from the already saved:".$input["rulesSet"]."/".$g->rules);
          break;
        } 
        else {
          $parsedRules=json_decode($input["rulesSet"],true);
        }
      } //else throw new Exception ("Something is wrong with rulesSet or saved");
      
      require_once("PlayHelper.php");
      
      $fleetModel=PlayHelper::validateFleet( $input["fleet"],$parsedRules );
      if (!is_array($fleetModel)) {
        $r = $hc::fail("Ships must be straight and not to touch each other. Try new ones.");
        break;      
      }
      if ( !is_array($parsedRules["forces"]) ) throw new Exception("Wrong parameter forces in rulesSet");
      if ( $parsedRules["demandEqualForces"] ) {
        if (! PlayHelper::validateForces($fleetModel,$parsedRules["forces"]) )  {
          $r = $hc::fail("Sizes of your ships does not comply with what is demanded by rules. Try new ones.");
          break;
        }
      }
      // finally OK
      $g->ships[$side] = json_encode($fleetModel);
      if ($state=="ships") {
        $g->setState("confirmingShips");
        $g->setActive($side);
        $db->saveGame($g,true);
        $r = $hc::noteState("Wait for your opponent ".$g->getName($otherSide),$state);
        break;
      } else if ($state=="confirmingShips" && $otherSide==$g->getActive()) {
        $g->setStage("fight");
        $g->setState("fight");
        $fa=$parsedRules["firstActiveAB"];
        if ( $fa!="A" && $fa!="B" ) $r = $hc::fail("Invalid first move side:".$fa);
        $g->setActive($fa);
        $g->setClip ( PlayHelper::loadClip($fa,$g) );
        $stat = json_decode($g->stats,true);
        PlayHelper::addToStats( $stat, $side, PlayHelper::makeFleetStat($fleetModel) );
        $otherFleetModel = json_decode($g->ships[$otherSide] , true);
        if (!is_array($otherFleetModel)) throw new Exception ("Failed to decode ships from ".$otherSide);
        PlayHelper::addToStats( $stat, $otherSide, PlayHelper::makeFleetStat($otherFleetModel) );
        $g->stats = json_encode($stat);
        $db->saveGame($g,true);
        $r = $hc::noteState("Ready to fight",$state);
        break;
      } else if ($state=="confirmingShips" && $side==$g->getActive()) {
        $db->saveGame($g,true);
        $r = $hc::noteState("New ships accepted. Wait for your opponent",$state);
        break;
      }
      else { throw new Exception ("Something is wrong with stage/state/active"); }
    case "queryStage":
      if ($state=="ships") {
        $note="Draw your ships, then press Done";      
      } else if ($state=="confirmingShips" && $otherSide==$g->getActive()) {
        $note="Your opponent is ready and waiting for you";
      } else if ($state=="confirmingShips" && $side==$g->getActive()) {
        $note="Wait for your opponent";      
      }
      else { throw new Exception ( "Something is wrong with stage/state/active :".$g->getStage()."/".$g->getState()."/".$g->getActive() ); }
      $r = $hc::noteState($note,$state);
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
        }
      }
      
      // update statistics 
      $g->incTotal();
      $g->decClip();
      $newFleetStat = PlayHelper::makeFleetStat($fleetModel);
      //var_dump($newFleetStat);
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
      $g->moves[$side] = $hc::appendToJson ( $g->moves[$side], $moveSum );
      if ( in_array($hit,["h","w","f"]) ) {
        $g->ships[$otherSide] = json_encode($fleetModel);  
      }
      $db->saveGame($g,true);
      
      // make response   
      $r = '{"move":'.$moveSum.',"note":"'.$note.'"}';
      $r = $hc::appendToJson( $r, $g->exportPair(["activeSide","clip","stats"]) ); 
      break;
      
    case "queryMoves":
      $now=$g->getTotal();
      if ( !isset( $input["latest"] ) || $input["latest"] > $now ) {
        $r = $hc::fail("Missing or wrong argument Latest");
        break;      
      }
      $latest=$input["latest"];
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
      $moves=$g->moves[$otherSide];
      $movesArr=json_decode($moves);
      if (!is_array($movesArr)) throw new Exception ("Failed to decode moves from ".$moves);
      //print_r($movesArr);
      foreach($movesArr as $move) {
        if ( $latest < $move[0] ) { $freshMoves [] = $move; }
      }
      $fms=[$otherSide=>$freshMoves];
      $freshMovesJson=json_encode($fms);
      if ( $g->isActive($side) ) $note="Make your move";
      else $note="Enemy is still striking";
      $r = $hc::noteState($note,$state);
      $r = $hc::appendToJson( $r, '"moves":'.$freshMovesJson );
      $r = $hc::appendToJson( $r, $g->exportPair(["stats","activeSide","clip"]) );
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
}// end class Fight

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
  
  static function destroy() {
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
      mA TEXT,
      mB TEXT,
      st TEXT,
      cl TEXT,
      mt TEXT
    )";
    $ret = parent::$relayDbo->exec($qCreateTable);
    //echo(">".$ret);
  }

  protected static $dbKeys=["nA", "nB", "ti", "tc", "tf", "af", "stage", "state", "acs", "pA", "pB", "rl", "sA", "sB", "mA", "mB", "st", "cl", "mt"];
  
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

    

class Game {
  protected $id=null;
  public static $sides=["A","B"];
  protected $players=["A"=>"","B"=>""];
  public $timeInit=0;
  public $timeConnected=0;
  public $timeFinished=0;
  public $agendaFile="agenda.json";
  protected $stages=["zero","intro","rules","ships","fight","finish","aborted"];
  protected $states=["zero","connecting","picking","converged","confirming","ships","confirmingShips","fight","finish","aborted"];
  protected $stage="zero";
  protected $state="zero";
  protected $activeSide="";
  protected $picks=["A"=>"{}","B"=>"{}"];
  public $rules="{}";
  public $ships=["A"=>"[]","B"=>"[]"];
  public $moves=["A"=>"[]","B"=>"[]"];
  public $stats='{}';
  protected $clip=0;
  protected $total=0;
  
  function __construct() {
    $defaultPicks='{"firstMove":0,"forces":0,"strikeRule":0,"level":0}';
    $this->picks["A"]=$this->picks["B"]=$defaultPicks;
    $defaultStats='{"strikes":0,"hits":0,"afloat":0,"largest":0}';
    $this->stats = '{"A":'.$defaultStats.',"B":'.$defaultStats.'}';
  }
  
  function setTimeInit() { $this->timeInit=time(); }
  
  function setTimeConnected() { $this->timeConnected=time(); }
  
  function setTimeFinished() { $this->timeFinished=time(); }
  
  function getId() { return($this->id); }

  function setStage($newStage) {
    if (! in_array($newStage,$this->stages) ) throw new Exception("Invalid target stage:".$newStage."!");
    $this->stage = $newStage;
  }
  
  function getStage() { return($this->stage); }
  
  function setState($newState) {
    if (! in_array($newState,$this->states) ) throw new Exception("Invalid target state:".$newState."!");
    $this->state = $newState;
  }
  
  function getState() { return($this->state); }
  
  function getPick($side) {
    if (! in_array($side,self::$sides) ) throw new Exception("Invalid side:".$side."!");
    return ( $this->picks[$side] );    
  }

  function setPick($side,$json) {
    if (! in_array($side,self::$sides) ) throw new Exception("Invalid side:".$side."!");
    $this->picks[$side] = $json;    
  }
  
  function getName($side) {
    if (! in_array($side,self::$sides) ) throw new Exception("Invalid side:".$side."!");
    return ( $this->players[$side] );    
  }

  function setName($side,$name) {
    if (! in_array($side,self::$sides) ) throw new Exception("Invalid side:".$side."!");
    $this->players[$side] = $name;    
  }
  
  function clearActive() { $this->activeSide=""; }
  
  function setActive($side) {
    if (! in_array($side,self::$sides) ) throw new Exception("Invalid side:".$side."!");
    $this->activeSide = $side;
  }
  
  function isActive($side) {
    if (! in_array($side,self::$sides) ) throw new Exception("Invalid side:".$side."!");
    if ( $this->activeSide === $side ) return true;
    return false;
  }
  
  function getActive() { return($this->activeSide); }
  
  function incTotal() { $this->total+=1; }
  
  function getTotal() { return ($this->total); }

  function decClip() { $this->clip = $this->clip - 1; }
  
  function incClip() { $this->clip = $this->clip + 1; }
  
  function getClip() { return ($this->clip); }
  
  function setClip($v) { $this->clip = $v; }
  
  function export() {
    $r=[];
    $r["id"]=$this->id;
    $r["nA"]=$this->getName("A");
    $r["nB"]=$this->getName("B");
    $r["ti"]=$this->timeInit;
    $r["tc"]=$this->timeConnected;
    $r["tf"]=$this->timeFinished;
    $r["af"]=$this->agendaFile;
    $r["stage"]=$this->getStage();
    $r["state"]=$this->getState();
    $r["acs"]=$this->activeSide;
    $r["pA"]=$this->getPick("A");
    $r["pB"]=$this->getPick("B");
    $r["rl"]=$this->rules;
    $r["sA"]=$this->ships["A"];
    $r["sB"]=$this->ships["B"];
    $r["mA"]=$this->moves["A"];
    $r["mB"]=$this->moves["B"];
    $r["st"]=$this->stats;
    $r["cl"]=$this->clip;
    $r["mt"]=$this->total;
    return $r;
  }
  
  function import($r) {
    if (!is_array($r)) throw new Exception ("Non-array argument");
    $this->id=$r["id"];
    $this->setName("A",$r["nA"]);
    $this->setName("B",$r["nB"]);
    $this->timeInit=$r["ti"];
    $this->timeConnected=$r["tc"];
    $this->timeFinished=$r["tf"];
    $this->agendaFile=$r["af"];
    $this->setStage($r["stage"]);
    $this->setState($r["state"]);
    $this->activeSide=$r["acs"];
    $this->setPick("A",$r["pA"]);
    $this->setPick("B",$r["pB"]);
    $this->rules=$r["rl"];
    $this->ships["A"]=$r["sA"];
    $this->ships["B"]=$r["sB"];
    $this->moves["A"]=$r["mA"];
    $this->moves["B"]=$r["mB"];
    $this->stats=$r["st"];
    $this->clip=$r["cl"];
    $this->total=$r["mt"];
  }
  
  function exportPair($keys) {
    if (!is_array($keys)) $keys=[ $keys ];
    $pairs=[];
    foreach ($keys as $key) {   
      if (! isset($this->$key) ) throw new Exception ("Invalid key:".$key."!");
      if ( is_array($this->$key) ) { 
        $val=json_encode($this->$key);
        $val=str_replace(['"{','}"'],['{','}'],$val);
        $val=str_replace(['"[',']"'],['[',']'],$val);
        $val=str_replace('\\"','"',$val);
        /*echo(">".$val);*/ 
      } 
      else if ( is_string($this->$key) && substr($this->$key,0,1)==="{" ) $val=$this->$key;
      else $val='"'.$this->$key.'"';
      $pairs[]='"'.$key.'":'.$val;
    }
    return (implode(",",$pairs));
  }
  
  static function getOtherSide($side) {
    if (!in_array($side,self::$sides)) throw new Exception ("Wrong side:".$side."!");
    if ($side===self::$sides[0]) return (self::$sides[1]);
    if ($side===self::$sides[1]) return (self::$sides[0]);
  }
  
  function checkConverged() {
    $s0=self::$sides[0];
    $s1=self::$sides[1];
    if ( $this->getPick($s0) === $this->getPick($s1) &&  strlen($this->getPick($s0)) > strlen("{}") ) return true;
    return false;
  }
  
}

// MAIN

$controller=new HubManager();
$ret=$controller->go(null);
//echo("Trace:".$controller->trace);
print($ret);

?>