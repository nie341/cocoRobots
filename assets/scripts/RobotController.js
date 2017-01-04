cc.Class({
    extends: cc.Component,

    properties: {
        speed: {
            default: 0.5
        }
    },

    onLoad: function () {
        this._bounds = this.node.parent.getBoundingBox();

        // start idle (no target)
        this._target = this.node.position;
    },
    
	// setTarget - sets the target point for moving towards
	setTarget: function( moveTo ) {
		if( this._bounds.contains(moveTo) ) {
			this._target = moveTo;
		} else {
			cc.log('RobotController::setTarget(',moveTo,') would move out of bounds');
		}
	},
	
    //
    // onCollisionEnter - should only be called when running in continuous mode
    // 	is called by the collision manager
    onCollisionEnter: function(other,self) {    	
//     	cc.log('RobotController::onCollisionEnter other=',other,' self=',self);
        if( other.name.startsWith('Player') ) {
            //cc.log('RobotController::onCollisionEnter: robot killed player!');
            // player will detect this too. Only report on my own death
            return;
        } else {
            // process collisions
            //cc.log('RobotController::onCollisionEnter: robot is trashed!');
            var trashevent = new cc.Event.EventCustom('TRASHED',true);
            trashevent.setUserData(this.node);
            this.node.dispatchEvent(trashevent);
            this.node.color = cc.Color.RED;
            // should destroy myself and relpace with a "trash"
        }
    },

    // onCollisionStay: function(other,self) {   
    //     if( !this._stayed ) {
    //         cc.log('RobotController::onCollisionStay: robot is still touching ' + other.name );
    //         this._stayed = true;
    //     }
    // }
    

    // called every frame, uncomment this function to activate update callback
//     update: function (dt) {
//     	cc.log('RobotController: update');
// 		// TO DO - move towards target position with given speed...
// 		if( this.node.x < this._target.x ) this.node.x += this.speed * dt;
// 		if( this.node.x > this._target.x ) this.node.x -= this.speed * dt;
// 		if( this.node.y < this._target.y ) this.node.y += this.speed * dt;
// 		if( this.node.y > this._target.y ) this.node.y -= this.speed * dt;
//     },
});
