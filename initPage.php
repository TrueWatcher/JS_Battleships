<?php

class CommandException extends Exception;
class AuthException extends Exception;


  protected function go($act="",$context=[]) {
    $input=$this->input;
    $cookie = & $this->cookie;
    $hc=$this->helperClass;
    
    $act="*"; 
    $aStage="*";
    $credentials=[];
    $context=[];
    $r="{}";// normally JSON string
    $inState=$outState="*";// in trace reads as "unknown, probably same as prior to this action"

    try {
      list($act,$aStage)=$this->readCommandStage($input);// throws excCommand

      $credentials=$this->readCredentials($cookie,$input);// does not throw excAuth, just returns error message
      if ( ! is_array($credentials) ) { $context=$this->nonRegContext($act,$aStage,$credentials); } // throws ExcAuth
      else {
        $context=$this->getGame($credentials);// throws excAuth
      }
      $stage=$this->checkStage($act,$aStage,$context["stage"]);// throws excCommand on stage mismatch
      $stageController=$this->getStageController($aStage,$input,$cookie,$hc); // by aStage from command
      $inState = $stageController->inState = $context["state"];
      $r=$stageController.go($act,$context);
      $outState = $stageController->outState; 
    } 
    catch (AuthException $ae) {
      $r = $hc::noteState($ae->getMessage(),"intro");
      exit($r);// minimal information
    }
    catch (CommandException $ce) {
      $r = $hc::noteState($ae->getMessage(),$context["state"]);
      // go on -- add trace, stage etc.
    }
    
    $this->track( [ $stage, $inState, $act, $outState, $hc::collectKeys2($r) ] );
    $r=$hc::appendToJson($r,'"trace":"'.$this->trace.'"');
    return($r); 
  }// end go
  
  protected function readCommandStage($input) {
    $stage=$hc::detectStage($input);
    if ( !$stage ) throw new CommandException("Empty or invalid input");
    if ( isset($input[$stage]) ) {
      $command = $input[$stage];
    }
    else { throw new CommandException("Empty command"); }
    return ([$command,$stage]);
  }
  
  protected $allowAuthByInput=1;
  protected $nonRegistered=[ "intro=register", "adm=rmDb" ];
  protected $allowedStageMismatches=[ "intro=queryStage", "intro=queryAll", "intro=abort", "rules=queryPick", "rules=confirm", "ships=confirmShips", "ships=queryStage", "fight=queryMoves", "finish=new", "finish=queryStage", "adm=dumpPage" ];
  
  protected function readCredentials($cookie,$input) {
    $hc=$this->helperClass;
    $name=$side=$id='';
    if ($this->allowAuthByInput && isset($input["reqId"]) ) { 
      if ( ! $hc::readReqId($input["reqId"],$name,$side,$id) ) {
        return("Failed to parse reqId=".$input["reqId"]);     
      }
    }
    else if ( ! $hc::readCookie($cookie,$name,$side,$id) ) {
      return("Please, register");
    }
    return (["name"=>$name,"side"=>$side,"id"=>$id]);
  }
  
  protected function nonregContext($command,$aStage,$errorMsg) {
    $pair=$aStage."=".$command;
    if ( ! in_array($pair,$this->nonRegistered) ) { throw new AuthException($errorMsg); }
    $db=new $dbClass(true);
    return(["db"=>$db,"name"=>"*","side"=>"*","id"=>"*","otherSide"=>"*","gameObj"=>"","stage"=>"*","state"=>"*"]);
  }
  
  protected function getGame($sideNameId) {
    $hc=$this->helperClass;
    if (! is_array $sideNameId) throw new Exception ("Non-array argument:".$sideNameId);
    list($side,$name,$id)=$sideNameId;
    
    $otherSide=Game::getOtherSide($side);
    $db=new $dbClass(true);
    try {
      $gameObj=$hc::findRecord($db,$name,$side,$id);
    }
    catch (Exception $e) { throw new AuthException($e->getMessage()); }
    $state=$gameObj->getState();
    $gStage=$gameObj->getStage();
    return(["db"=>$db,"name"=>$name,"side"=>$side,"id"=>$id, "otherSide"=>$otherSide,"gameObj"=>$gameObj,"stage"=>$state,"state"=>$gStage]);
  }
  
  protected function checkStage($command,$aStage,$gStage) {
    if ($gStage===$aStage) return ($aStage);
    if ($gStage==="*")  return ($aStage);// authentication was legally bypassed
    $pair=$aStage."=".$command;
    if ( in_array($pair,$this->allowedStageMismatches ) return ($aStage);
    throw new CommandException("Out-of-order command/stage:".$command."/".$aStage." while in stage ".$gStage);
  }
  
  protected function getStageController($aStage,$input,$cookie,$hc) {
   $Sc = self::$stageClasses [$stage];
   $stageController = new  $Sc($input,$cookie,$hc);
   return ($stageController);
  }
?>