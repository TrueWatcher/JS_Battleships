<?php
// v.0.0.3 decoupled HubManager from input and cookie, added trace
//   0.0.4 fixed '"{\"' in Game::exportPair
//   0.0.5 refactoring: new classes Intro and Rules 
//   0.0.6 minimal unit tests

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
  
  abstract function go();
}

/**
 * The outermost controller.
 * Resolves game stage, instantiates and calls the appropriate subcontroller.
 * Also manages trace for debugging.
 */
class HubManager extends DetachableController {

  public $trace="";
  
  function track($subj) {
    $separator=">";
    if (!is_array($subj)) $subj=[$subj];
    foreach ($subj as $str) {
      if ( $str===false ) $str="false";
      if (!$str) $str="null";
      $this->trace.=$separator.$str;
    }
  }

  public static $stageClasses=["intro"=>"Intro", "rules"=>"Rules", "ships"=>"Ships", "play"=>"Play", "adm"=>"Adm"];
  
  function go() {
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
    $r = $stageController->go();
    $this->track( [ $stage, $stageController->inState, $stageController->act, $stageController->outState, $hc::collectKeys2($r) ] );
    $r=$hc::appendToJson($r,'"trace":"'.$this->trace.'"');
    return($r);    
  }
}// end HubManager

class Intro extends DetachableController {
  
  function go() {
    $input=$this->input;
    $cookie = & $this->cookie;
    $hc=$this->helperClass;
  
    $junk=null;
    $name=$side=$id="";
    $state="*";
    $r=null;

    //print_r($cookie);
    $act="";
    if ( isset($input["intro"]) ) {
      $act=$input["intro"];
      $this->act=$act;
    }
    
    $db=new RelaySqlt(true);
    
    switch ($act) {
    case "register":
      $cookiePresent=$hc::readCookie($cookie,$junk,$junk,$junk);
      if (!$cookiePresent) { 
        if ( empty($input["playerName"]) || empty($input["playerName"]) ) {
          $r = $hc::fail("Missing name(s)");
          break;
        }
        // look for open deal records (with state=="connecting")
        $open = $db->findByOpponent($input["playerName"]);
        //echo("found record:".$open.".");
        if ( $open===false ) {
          $d=new Game();
          $this->inState = "null";
          $pn=$input["playerName"];
          $d->setName("A",$pn);
          $d->setName("B",$input["enemyName"]);
          $d->setTimeInit();
          $d->setState("connecting");
          $d->setStage("intro");
          $newId = $db->saveGame($d);
          $hc::setCookie($cookie,$pn,"A",$newId);
          $r = '{'.$d->exportPair( ["stage","state","players"] ).'}';
          break;
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
          $d=new Game();
          $d->import($arr);
          $state=$d->getState();
          $this->inState=$state;
          $d->setTimeConnected();
          if ($d->checkConverged()) $d->setState("converged");// default picks are equal
          else $d->setState("picking");
          $d->setStage("rules");
          $db->saveGame($d,true);
          $hc::setCookie($cookie,$input["playerName"],"B",$d->getId());
          $r = '{'.$d->exportPair( ["stage","state","players"] ).'}';
          break;
        }
      }
      else {
        $r = $hc::fail("You are already registered");
        break;
      }
      throw new Exception ("Wrong state/command ".$state."/".$act."!");
    
    case "abort":
      if ( 3 != $hc::readCookie($cookie,$name,$side,$id) ) {
        $r = $hc::fail("Please, register");
        break;
      }
      $d=$hc::findRecord($db,$name,$side,$id);
      $state=$d->getState();
      $this->inState=$state;
      if ( in_array ( $state, ["zero","finished"] ) ) {
        $r = '{"note":"No state change, only clearing cookie"}';
        break;
      }
      if ( in_array ( $state, ["picking","converged","confirming"] ) ) {
        $r = $hc::fail("An active state is not supposed to be aborted");
        break;
      }
      $d->setState("aborted");
      $d->setStage("aborted");
      $db->saveGame($d,true);
      $r = $hc::noteState("Session aborted by user","aborted");
      break;

    case "queryFull":
      if ( 3 != $hc::readCookie($cookie,$name,$side,$id) ) {
        $r = $hc::noteState("Brand new session","zero");
        break;
      }
      //$os=Game::getOtherSide($side);
      $d=$hc::findRecord($db,$name,$side,$id);
      $state=$d->getState();
      $this->inState=$state;
      // state noChange
      $r = '{'.$d->exportPair( ["stage","state","players","picks"] ).'}';
      switch ($state) {
      case "finished":
      case "aborted":
        $note="Game is closed";
        break;
      case "zero":
        throw new Exception ("queryFull on zero state");
      default:
        $note="Resuming session";
        break;
      }
      $r=$hc::appendToJson($r,'"note":"'.$note.'"');
      break;
      
    default:
      $r = $hc::fail("Missing or invalid command:".$act."!", $state);
      break;
    }// end switch
    
    if (isset($d) && is_object($d)) $resState=$d->getState();
    else $resState="?";
    $this->outState=$resState;
    return $r;
  }
}

class Rules extends DetachableController {
   
  function go() {
    $input=$this->input;
    $cookie = & $this->cookie;
    $hc=$this->helperClass;
  
    $junk=null;
    $name=$side=$id="";
    $state="*";
    $r=null;

    //print_r($cookie);
    $act="";
    if ( isset($input["rules"]) ) {
      $act=$input["rules"];
      $this->act=$act;
    }
    
    $db=new RelaySqlt(true);
    
    switch ($act) {
    case "queryPick":
      $cookiePresent=$hc::readCookie($cookie,$name,$side,$id);
      if ($cookiePresent!=3) {
        $r = $hc::fail("Please, register");
        break;
      }
      $os=Game::getOtherSide($side);
      $d=$hc::findRecord($db,$name,$side,$id);
      $state=$d->getState();
      $this->inState=$state;
      if ( $state == "connecting" ) {
        $note='Waiting for another player '.$d->getName($os);
        $r = $hc::noteState($note,$state);
        break;
      }
      // state noChange      
      $r='{"picks":{"'.$os.'":'.$d->getPick($os).'}}';// quotes around Pick make problems for FF
      $r=$hc::appendToJson($r,$d->exportPair(["stage","state"]));
      if ( $state == "confirming" && $d->isActive($side) ) $r=$hc::appendToJson($r,'"note":"Waiting for '.$d->getName($os).'"');
      if ( $state == "finished" ) $r=$hc::appendToJson($r,'"note":"Done!"');
      if ( $state == "aborted" ) $r=$hc::appendToJson($r,'"note":"Session aborted by user"');
      break;
    case "updPick":
      if ( 3 != $hc::readCookie($cookie,$name,$side,$id) ) {
        $r = $hc::fail("Please, register");
        break;
      }
      if (!$input["pick"]) {
        $r = $hc::fail("No data found");
        break;
      }
      $d=$hc::findRecord($db,$name,$side,$id);
      $state=$d->getState();
      $this->inState=$state;
      if ( ! in_array ( $state, ["picking","converged","confirming"] ) ) {
        $r = '{"note":"No update allowed in the state '.$state.'"}';
        break;
      }
      $d->setPick($side,$input["pick"]);
      //echo("*".$input["pick"]." >".$d->getPick($side)."!");
      if ( $d->checkConverged() ) {
        $d->setState("converged");
      }
      else {
        $d->setState("picking");
        $d->clearActive();
      }
      $db->saveGame($d,true);
      //print_r($db->readGame($d->getId()));
      // return value same as queryPick
      $os=Game::getOtherSide($side);
      $r='{"picks":{"'.$os.'":'.$d->getPick($os).'}}';
      $r=$hc::appendToJson($r,$d->exportPair(["stage","state"]));
      break;
    case "confirm":
      if ( 3 != $hc::readCookie($cookie,$name,$side,$id) ) {
        $r = $hc::fail("Please, register");
        break;
      }
      $d=$hc::findRecord($db,$name,$side,$id);
      $state=$d->getState();
      $this->inState=$state;
      if ( in_array ( $state, ["connecting","finished"] ) ) {
        $r = '{"note":"No confirmation allowed in the state '.$state.'"}';
        break;
      }
      if ( $state=="picking" ) {
        $r = $hc::fail("Answers are different or empty, go on bargaining", $state);
        break;
      }
      if ( $state=="converged" ) {
        if ( ! $d->checkConverged() ) throw new Exception("Non-equal picks in Converged stste");
        if ( isset($input["pick"]) ) {
          if ( $input["pick"] !== $d->getPick($side) ) {
            $r = $hc::fail("Given answers ".$input["pick"]." differ from the recorded ".$d->getPick($side)." !", $state);
            break;
          }
        }
        $d->setActive($side);
        $d->setState("confirming");
        $db->saveGame($d,true);
        $r = '{'.$d->exportPair(["stage","state"]).'}';
        break;
      }
      if ( $state=="confirming" ) {
        if ( ! $d->checkConverged() ) throw new Exception("Non-equal picks in Confirming stste");
        if ( $d->isActive($side) ) {// Confirm from this side already received
          $r = $hc::noteState("Wait for you opponent",$state);
          break;
        }
        else {
          $d->setState("finished");
          $d->setStage("ships");
          $db->saveGame($d,true);
          $r=$hc::noteState("Done!",$state);
          // add picks ?
          break;
        }
      }
      throw new Exception ("Wrong state/command ".$state."/".$act."!");

    default:
      $r = $hc::fail("Missing or invalid command:".$act."!", $state);
      break;
    }// end switch
    
    if (isset($d) && is_object($d)) $resState=$d->getState();
    else $resState="?";
    $this->outState=$resState;
    return $r;

  }
}

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
  
  static function findRecord($db,$name,$side,$id) {
    $rec=$db->readGame($id);
    if (!$rec) throw new Exception("Wrong id:".$id."!");//return (false);
    $d=new Game();
    if (! in_array($side,Game::$sides) ) throw new Exception("Wrong side:".$side."!");
    $d->import($rec);
    if ( $name !== $d->getName($side) ) throw new Exception("Name ".$name." and id ".$id." don't match");
    return($d);
  }
  
  static function appendToJson($json,$pair) {
    $l=strlen($json);
    if (substr($json,$l-1,1)!="}") throw new Exception ("JSON argument doesn't end with }");
    $r=substr($json,0,$l-1).",".$pair."}";
    return $r;
  }
  
  /**
   * Collects keys from upper and next levels.
   * @return string
   */
  static function collectKeys2($json,$separator="_") {
    $keys=[];
    $obj=json_decode($json);
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
      mt TEXT
    )";
    $ret = parent::$relayDbo->exec($qCreateTable);
    //echo(">".$ret);
  }

  protected static $dbKeys=["nA","nB","ti","tc","tf","af","stage","state","acs","pA","pB","rl","sA","sB","mA","mB","mt"];
  
  public function saveGame(Game $d,$overwrite=false) {
    $arr=$d->serialize();
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
  
  function findByOpponent($name) {
    $qFindB="SELECT id FROM '".self::$table."' WHERE state='connecting' AND ( nB=:nB )";// OR nA=;nA)
    $stmt=parent::$relayDbo->prepare($qFindB);
    $stmt->bindValue(':nB',$name,SQLITE3_TEXT);
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
  protected $stages=["zero","intro","rules","ships","play","over","aborted"];
  protected $states=["zero","connecting","picking","converged","confirming","finished","aborted"];
  protected $stage="zero";
  protected $state="zero";
  protected $activeSide="";
  protected $picks=["A"=>"{}","B"=>"{}"];
  public $rules="{}";
  public $ships=["A"=>"{}","B"=>"{}"];
  public $moves=["A"=>"{}","B"=>"{}"];
  public $movesTotal=0;
  
  function __construct() {
    $defaultPicks='{"firstMove":0,"forces":0}';
    $this->picks["A"]=$this->picks["B"]=$defaultPicks;
  }
  
  function setTimeInit() {
    $this->timeInit=time();
  }
  
  function setTimeConnected() {
    $this->timeConnected=time();
  }
  
  function setTimeFinished() {
    $this->timeFinished=time();
  }
  
  function getId() {
    return($this->id);
  }

  function setStage($newStage) {
    if (! in_array($newStage,$this->stages) ) throw new Exception("Invalid target stage:".$newStage."!");
    $this->stage = $newStage;
  }
  
  function getStage() {
    return($this->stage);
  }
  
  function setState($newState) {
    if (! in_array($newState,$this->states) ) throw new Exception("Invalid target state:".$newState."!");
    $this->state = $newState;
  }
  
  function getState() {
    return($this->state);
  }
  
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
  
  function clearActive() {
    $this->activeSide="";
  }
  
  function setActive($side) {
    if (! in_array($side,self::$sides) ) throw new Exception("Invalid side:".$side."!");
    $this->activeSide = $side;
  }
  
  function isActive($side) {
    if (! in_array($side,self::$sides) ) throw new Exception("Invalid side:".$side."!");
    if ( $this->activeSide === $side ) return true;
    return false;
  }
  
  function getActive() {
    return($this->activeSide);
  }
  
  function incTotal() {
    $this->movesTotal+=1;
  }
  
  function serialize() {
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
    $r["mt"]=$this->movesTotal;
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
    $this->movesTotal=$r["mt"];
  }
  
  function exportPair($keys) {
    if (!is_array($keys)) $keys=[ $keys ];
    $pairs=[];
    foreach ($keys as $key) {   
      if (! isset($this->$key) ) throw new Exception ("Invalid key:".$key."!");
      if ( is_array($this->$key) ) { 
        $val=json_encode($this->$key);
        $val=str_replace(['"{','}"'],['{','}'],$val);
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
$ret=$controller->go();
//echo("Trace:".$controller->trace);
print($ret);

?>