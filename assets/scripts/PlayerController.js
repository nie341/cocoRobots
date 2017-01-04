cc.Class({
    extends: cc.Component,

    properties: {
         speed: {
            default: 0.5
        }
   },

    // use this for initialization
    onLoad: function () {
        this._bounds = this.node.parent.getBoundingBox();
    },

	// any player collision must mean death :-(
    onCollisionEnter: function(other,self) {    	
		var killevent = new cc.Event.EventCustom('KILLED',true);
		killevent.setUserData(this.node);
		this.node.dispatchEvent(killevent);
    },

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});
