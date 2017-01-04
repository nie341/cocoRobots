const TAGS = { "PLAYER": 1, "ROBOT": 2, "TRASH": 3 };
const TELEPORT_MODES = { "CENTER": 0, "RANDOM": 1, "SAFE": 2 };

// function toggles
const MOVE_SWIPE = true;

cc.Class({
    extends: cc.Component,

    properties: {
        starting_bots : {
        	default: 6
        },
        
        move_speed: {
        	default: 0.5
        },
        
        player: {
            default: null,
            type: cc.Prefab
        },
        
        robot: {
            default: null,
            type: cc.Prefab
        },
        
		rubbish: {
            default: null,
            type: cc.Prefab
        },
        
        swipe_texture: {
        	default: null,
        	type: cc.SpriteFrame
        },
        
        font: {
            default: null,
            type: cc.Font
        }
        
    },
	
    // use this for initialization
    onLoad: function () {
    	this._level =  1;
        this._teleportMode = TELEPORT_MODES.SAFE;
        this._teleports = 3;
        this._tiledMap = this.node.getComponent(cc.TiledMap);
        this._mapSize = this._tiledMap.getMapSize();
        this._tileSize = this._tiledMap.getTileSize();
        
        // find the text boxes...
        this._levelText = cc.find('/Canvas/StatusBox/LevelText').getComponent(cc.Label);
        this._teleportText = cc.find('/Canvas/StatusBox/TeleportText').getComponent(cc.Label);
        this._teleportBtn  = cc.find('/Canvas/TeleportButton').getComponent(cc.Button);

        this.newGame(); 
    },
    
    newGame: function() 
    {
        // clear all existing content
        var savetmx = this._tiledMap.tmxAsset;
        this.node.removeAllChildren();
        
        // reload the map
        this._tiledMap.tmxAsset = '';
        this._tiledMap.tmxAsset = savetmx;
        //this._tiledMap._applyFile();
        
		//cc.log('newGame with grid=', this._mapSize, ' scale=', this._tileSize );
		
		// start of game settings
        this._level = 1;
        this._teleportMode = TELEPORT_MODES.SAFE;
        this._teleports = 2;
        this.startLevel();
    },
    
    startLevel: function()
    {    	
    	// set initial player stats...
    	this._teleports = Math.max(this._teleports+1,3);
    	this._levelText.string    = this._level;
		this._teleportText.string = this._teleports;
    	
    	// make sure there is no remaining splat on the home location
    	for( var c in this.node.children ) {
    		var child = this.node.children[c];
    		if( child.tag == TAGS.TRASH && cc.pSameAs(child.position,cc.p(0,0)) ) {
    		    child.getComponent(cc.BoxCollider).enabled = false;
    			child.destroy();
    		}
    	}
    	
    	// set up robots
    	this._robotCount = 0;
        for( var r=0; r<this.starting_bots + (this._level-1)*2; r++ ) {
			var robotpos;
			do {
				// get a new random position in the grid, at least two from the center
				robotpos = this.randomPosInGrid();
				
				// make sure there's no other robot here...
				for( var nch in this.node.children ) {
				    var rr = this.node.children[nch];
					if( rr.group == "deadly" && rr.position.equals(robotpos) ) {
// 						cc.log('startLevel: new robot can\'t use ', robotpos);
						robotpos = cc.p(0,0);
						break;
					}
				}
				
			} while( cc.pLengthSQ(robotpos) < cc.pLengthSQ(cc.pFromSize(this._tileSize))*2 );
			
			//cc.log('GameController: start robot at: ', robotpos);
            var robot = cc.instantiate( this.robot );
			robot.tag = TAGS.ROBOT;
			robot.parent = this.node;	
			robot.position = robotpos
			robot.size = this._tileSize;
			this._robotCount++;
			// robot controller is only required for continuous movement - so turn it off
            //var robotCtrl = robot.getComponent('RobotController');
            //if( robotCtrl ) robot.removeComponent(robotCtrl);
        }

        // set the player start point
        var player = cc.instantiate( this.player );
        player.parent = this.node;
		player.size = this._tileSize;
        player.position = cc.p(0,0);
        player.tag = TAGS.PLAYER;
        this._player = player;

        // start listening for moves
        this.enableInput();
		this._moving = false;
        this._endOfLevel = false;
        
        // start listening for collision events
		cc.director.getCollisionManager().enabled = true;
  	},
  	
  	/*
  	 * Function for touch input, tap & swipe
  	 */
    enableInput: function() {
    	if( MOVE_SWIPE ) {
    		this.node.on( cc.Node.EventType.TOUCH_START, this.onTouchStart, this );
    		this.node.on( cc.Node.EventType.TOUCH_MOVE,  this.onTouchMove,  this );
    		this.node.on( cc.Node.EventType.TOUCH_END,   this.onTouchEnd,   this );
    		this.node.on( cc.Node.EventType.TOUCH_CANCEL,this.onTouchCancel,this );
    	} else {
			this.node.on(cc.Node.EventType.TOUCH_START,this.onTouch,this);
		}
		this._teleportBtn.interactable = true;
		
		this.node.on('KILLED',this.onKilledMsg,this);
		this.node.on("TRASHED",this.onTrashedMsg,this);
    },
    
    disableInput: function() {
    	if( MOVE_SWIPE ) {
    		this.node.off( cc.Node.EventType.TOUCH_START, this.onTouchStart, this );
    		this.node.off( cc.Node.EventType.TOUCH_MOVE,  this.onTouchMove,  this );
    		this.node.off( cc.Node.EventType.TOUCH_END,   this.onTouchEnd,   this );
    	} else {
			this.node.off(cc.Node.EventType.TOUCH_START,this.onTouch,this);
		}
		this._teleportBtn.interactable = false;
		
		this.node.off('KILLED',this.onKilledMsg,this);
		this.node.off("TRASHED",this.onTrashedMsg,this);

    },
    

	// onTouch (for a single touch or click)
	onTouch: function(event) {
		var touch_pos = this.node.convertTouchToNodeSpace( event.touch );
		touch_pos.addSelf( cc.p(-this.node.width/2, -this.node.height/2) );
		
		// round off the touch position to centre of a full square...
		touch_pos.x = Math.round(touch_pos.x/this._tileSize.width) * this._tileSize.width;
		touch_pos.y = Math.round(touch_pos.y/this._tileSize.height) * this._tileSize.height;
		
		var move_to = this.nextPointFromTo(this._player.position,touch_pos);
		//cc.log('onTouch: touch @ ', touch_pos, ' player@', this._player.position);	
		this.movePlayerTo( move_to );
	},
	
	// startSwipe (for a touch_start event)
	// - save the location of this touch for later
	onTouchStart: function(event) {
		this._touch_start = this.node.convertTouchToNodeSpace( event.touch );
	},
	
	// endSwipe (for a single touch_end event)
	// - determine the length and direction of the touch from start to now
	// * calls onTouch if the touch is less than 1/2 grid scale on screen
	onTouchEnd: function(event) {
		this._touch_end   = this.node.convertTouchToNodeSpace( event.touch );
		
		// a short move counts as a touch
		if( cc.pDistanceSQ(this._touch_start,this._touch_end) < cc.pLengthSQ(cc.pFromSize(this._tileSize)) ) {
// 			cc.log("TAP (short swipe from ", this._touch_start, ")" );
			this.onTouch(event);
			return;
		} 

		// otherwise it's a swipe. Calculate the angle and show feedback...
		// angles are:
		//         90 (PI/4)
		//         |
		//    180--+-- 0
		// (PI/2)  |
		//        -90 (-PI/4)
		//
		var angle = cc.pToAngle(this._touch_end.sub(this._touch_start)) / Math.PI;
		var towards = this._player.position;
		if( angle < -0.875 || angle > 0.875 ) {
			//cc.log("left");
			towards.x -= this._tileSize.width;
		} else if( angle < -0.625 ) {
// 			cc.log("left + down");
			towards.x -= this._tileSize.width;
			towards.y -= this._tileSize.height;
		} else if( angle < -0.375 ) {
// 			cc.log("down");
			towards.y -= this._tileSize.height;
		} else if( angle < -0.125 ) {
// 			cc.log("right + down");
			towards.x += this._tileSize.width;
			towards.y -= this._tileSize.height;
		} else if( angle < 0.125 ) {
// 			cc.log("right");
			towards.x += this._tileSize.width;
		} else if( angle < 0.375 ) {
// 			cc.log("right + up");
			towards.x += this._tileSize.width;
			towards.y += this._tileSize.height;
		} else if( angle < 0.625 ) {
// 			cc.log("up");
			towards.y += this._tileSize.height;
		} else {
// 			cc.log("left + up");
			towards.x -= this._tileSize.width;
			towards.y += this._tileSize.height;
		}
		
		// show animated line where we swiped and move...
		this.movePlayerTo(towards);
		this._touch_start = null;
	},
	
	onTouchMove: function(event) {
		// simple function to leave a trail as the touch moves...
		if( !this._touch_start ) return;
		
		var screenPos = this.node.convertTouchToNodeSpace( event.touch )
			.add( cc.p(-this.node.width/2, -this.node.height/2) );
	
		// load and use the blank sprite...
		var touchpoint = new cc.Node('touch');
		touchpoint.parent = this.node;
		touchpoint.position = screenPos;
		touchpoint.color = cc.Color.BLUE;
		var sprite = touchpoint.addComponent(cc.Sprite);
		sprite.spriteFrame = this.swipe_texture;
		touchpoint.runAction( cc.sequence(
			cc.spawn(
				cc.tintTo(this.move_speed,cc.Color.GREEN),
				cc.fadeOut(this.move_speed)
			),
			cc.removeSelf(true)
		) );

	},
	
	onTouchCancel: function(event) {
		// cancel the start (to be sure)
		this._touch_start = null;
	},
	
	onTeleport: function() {
		if( this._moving || this._teleports <= 0 ) return;

		// update the teleport count
		this._teleports--;
		this._teleportText.string = this._teleports;
		
	    // determine the next posision according to teleport mode
	    var newpos;
	    switch( this._teleportMode ) {
			case TELEPORT_MODES.RANDOM: 
				// random mode might just kill you!
				newpos = this.randomPosInGrid();
				break;
			case TELEPORT_MODES.SAFE:	
				// safe mode loops random looking for a safe place - but gives up eventually
				var attempts = 0;
				var safe = true;
				var safeDistance = 4 * (this._tileSize.width*this._tileSize.width + this._tileSize.height * this._tileSize.height);
				do {
				    newpos = this.randomPosInGrid();
					safe = true;
					for( var rn in this.node.children ) {
					    var r = this.node.children[rn];
						if( (r.tag == TAGS.ROBOT || r.tag == TAGS.TRASH) 
						&& cc.pDistanceSQ(r.position,newpos)<safeDistance ) {
							safe = false;
							break;
						}
					}
					attempts++;
				} while( !safe && attempts < this._mapSize.width*this._mapSize.height )
			
				// if we can't find a safe place, stay where we are!
				if(!safe) newpos = this._player.position;
				break;
			default:
				newpos = cc.p(0,0);
	    }
	    
		this._moving = true;
	    this._player.getComponent(cc.BoxCollider).enabled = false;
		this._player.runAction( cc.sequence(
			cc.fadeOut(0.3),
			cc.moveTo(0,newpos),
			cc.fadeIn(0.3),
			cc.callFunc(this.endPlayerMove,this)
		) );
		
		if( this._teleports == 0 ) {
			this._teleportBtn.interactable = false;
		}
	},
		       
	randomPosInGrid: function() {
	   var tileOffset = cc.p(
            this.node.width*this.node.anchorX - this._tileSize.width/2,
            this.node.height*this.node.anchorY - this._tileSize.height/2
        );

	    var	gridx = Math.trunc( Math.random() * this._mapSize.width ) * this._tileSize.width;
		var gridy = Math.trunc( Math.random() * this._mapSize.height ) * this._tileSize.height;			
		var pos = cc.p(gridx,gridy).sub(tileOffset);
		
		return pos;
	},
	
// 	getRobotCount: function() {
// 	    var nRobots = 0;
// 	    for( var nindex in this.node.children ) {
// 	    	var cnode = this.node.children[nindex];
// 	        if( cnode.active && cnode.tag == TAGS.ROBOT ) nRobots++;
// 	    }
// 	    return nRobots;
// 	},
	
	nextPointFromTo: function( pFrom, pTo ) {
		var newpos = cc.pCompOp(pFrom,Math.round);
		if( newpos.x + this._tileSize.width <= pTo.x ) newpos.x += this._tileSize.width;
		if( newpos.x - this._tileSize.width >= pTo.x ) newpos.x -= this._tileSize.width;
		if( newpos.y + this._tileSize.height <= pTo.y ) newpos.y += this._tileSize.height;
		if( newpos.y - this._tileSize.height >= pTo.y ) newpos.y -= this._tileSize.height;

		return newpos;
	},
	
		       
	// move towards a position
	movePlayerTo: function( newpos ) {
		if( this._moving ) return;
		
		if( !this.node.getBoundingBox().contains(newpos.add(this.node.position)) ) {
			// out of bounds. don't move
			cc.log('moveTo ', newpos, ' would be out of bounds ', this.node.getBoundingBox(), '. Ignore it.');
			return;
		}
		
		// animate to the new position (and turn off collisions while we do)
		this._moving = true;
	    this._player.getComponent(cc.BoxCollider).enabled = false;
		this._player.runAction( cc.sequence(
			cc.moveTo(this.move_speed, newpos),
			cc.callFunc(this.endPlayerMove, this)
		) );
		
    },
    
    endPlayerMove: function() {
    	// make sure my own position is rounded off before moving robots...
    	this._player.position = cc.pCompOp(this._player.position,Math.round);
    	//cc.log('Player move complete. Player @ ', this._player.position);
    	this._player.getComponent(cc.BoxCollider).enabled = true;

		//this.checkGameOver();		
		this.moveRobots();
	},
    
    moveRobots: function() { 
//     	cc.log('GameController::moveRobots: player has moved. Robot turn.');
		this._robotsMoving = 0;
		for( var rn in this.node.children ) {
		    var n = this.node.children[rn];
			if( n.tag == TAGS.ROBOT ) {
				var newpos = this.nextPointFromTo(n.position,this._player.position);
				
				// animate the robot move
				this._robotsMoving++;
				n.getComponent(cc.BoxCollider).enabled = false;
				n.runAction( cc.sequence(
					cc.moveTo(this.move_speed,newpos),
					cc.callFunc(this.endRobotMove,this)
				) );
			}
		}
    },
    
    endRobotMove: function( robotnode ) {
    	robotnode.getComponent(cc.BoxCollider).enabled = true;
    	robotnode.position = cc.pCompOp(robotnode.position,Math.round);
    	this._robotsMoving--;
    	
    	if( this._robotsMoving == 0 ) {
     		//cc.log('All robots moved. Player turn.');
			//this.checkGameOver();
    		this._moving = false;
    	}
    },
    
//     checkGameOver: function() {
// 		if( this.getRobotCount() == 0 ) {
// 		    this.playerWins();
// 		    return;
// 		}
//     },
    
    quitGame: function(event) {
    	cc.game.end();
    },
    
    onTrashedMsg: function(event) {
    	//cc.log('GameController::onTrashedMsg() - robot was: ', event.getUserData());
    	var robotNode = event.getUserData();
		if( !cc.isValid(robotNode) || robotNode.active == false ) {
		    // already processed this node
		    return;
		}
		
		// Check is there is already a trashpile here
		var foundTrash = false;
		for( var c in this.node.children ) {
			var cnode = this.node.children[c];
			if( cnode.tag == TAGS.TRASH && cc.pSameAs(cnode.position,robotNode.position) )
			{
				foundTrash = true;
				break;
			}
		}
    	if( !foundTrash ) {
    		//cc.log('onTrashed: creating new trash...');
    	    var rubbishNode = cc.instantiate( this.rubbish );
    	    rubbishNode.parent = this.node;
    	    rubbishNode.position = robotNode.position;
    	    rubbishNode.size = robotNode.size;
    	    rubbishNode.tag = TAGS.TRASH;
    	}
    	
    	robotNode.active = false;
    	robotNode.destroy();
    	this._robotCount--;
    	if( this._robotCount == 0 ) this.playerWins();
    },
    
    onKilledMsg: function(event) {
    	//cc.log('GameController::onKilledMsg');
    	this.playerLoses();
    },
    
    playerLoses: function() {
        if( this._endOfLevel ) return;
    	cc.log('GameController:playerWins');
        
    	// disable input
    	this.disableInput();
        this._endOfLevel = true;

    	// animate player death...
    	this._player.runAction( cc.sequence(
    	    cc.spawn(
    	        cc.rotateBy(1.0, 90),
    	        cc.tintTo(0.25, 255, 0, 0),
    	        cc.blink(1.0, 5)
    	    ),
    	    cc.callFunc( this.gameOver, this )
    	) );

	},
	
	playerWins: function() {
    	if( this._endOfLevel ) return;
    	cc.log('GameController:playerWins');
    	
    	// disable input
    	this.disableInput();
        this._endOfLevel = true;

		//animate player win...
		this._player.runAction( cc.sequence(
			cc.spawn(
				cc.blink(1.0, 5),
				cc.scaleBy(1.0, 2)
			),
			cc.delayTime(2.0),
			cc.spawn(
			    cc.fadeOut(0.3),
			    cc.scaleBy(0.3,0.5)
			),
			cc.removeSelf(true)
		) );
		
		this._level++;

		// show a win message...
		var msgNode = new cc.Node('splash');
		msgNode.parent = this.node;
		msgNode.position = cc.p(0,0);
		msgNode.color = cc.Color.GREEN;
		var msgLabel = msgNode.addComponent( cc.Label );
		msgLabel.string = "Level Clear!";
		msgNode.runAction(
			cc.sequence(
				cc.spawn(
					cc.fadeIn(0.2),
					cc.scaleBy(1.0, 3),
					cc.moveBy(1.0, cc.p(0,-this._tileSize.height*2))
				),
				cc.delayTime(2.0),
				cc.spawn(
					cc.fadeOut(0.5),
					cc.scaleBy(0.5, 3),
				),
				cc.delayTime(0.5),
				cc.removeSelf(true),
				cc.callFunc( this.startLevel, this )
			)
		);
		
	},
	
    gameOver: function(event) {
    	cc.log('GameController::gameOver');
    			
		// show a lose message...
		var msgNode = new cc.Node('splash');
		msgNode.parent = this.node;
		msgNode.position = cc.p(0,0);
		msgNode.color = cc.Color.RED;
		var msgLabel = msgNode.addComponent( cc.Label );
		msgLabel.string = "GAME OVER";
		msgLabel.font = this.font;
		msgLabel.lineHeight = 30;
		msgNode.runAction(
			cc.spawn(
				cc.fadeIn(0.2),
				cc.scaleBy(1.0, 3),
				cc.moveBy(1.0, cc.p(0,-this._tileSize.height*4))
			)
		);

    },
        
    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {
	// },
});
