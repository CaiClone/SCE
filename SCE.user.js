// ==UserScript==
// @name        Showdown Compound Eyes
// @description This script adds information to pokemon showdown single battles.
// @namespace   https://github.com/caiclone
// @include   http://play.pokemonshowdown.com/*
// @version     1.2.2
// @require  https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant       none
// ==/UserScript==

//Adds or updates(if needed) the damageTaken variable on every pokemon in the battle
//Also the modified stats for every pokemon
function UpdateInfo() {
  for (var i = 0; i < 2; i++) {
    for (var j= 0; j<room.battle.sides[i].active.length;j++){
      var p= room.battle.sides[i].active[j];
      if(p){
        if (p.damageTaken === undefined || p.damageTaken.types != p.types) {
          p.damageTaken = getDamageChart(p.types);
        }
        p.minStats = getModStats(p,room.tooltips.getTemplateMinSpeed(p,p.level));
        p.maxStats = getModStats(p,room.tooltips.getTemplateMaxSpeed(p,p.level));
      }
    }
  }
  if(room.myPokemon){
    //Account for boosts in the active pokemon
    var myp = room.myPokemon[0];
    myp.volatiles = myp.volatiles || [];
    myp.modStats=getModStats(room.battle.mySide.active[0],myp);
  }
}
//assumes enemy max IV
function checkFastest() {
  var myPokemon = room.myPokemon;
  var enemy = room.battle.sides[1].active[0];
  if (myPokemon && enemy) {
    var EnemySpeed = enemy.maxStats.spe;
    var EnemySpeedMin = enemy.minStats.spe;
    var OwnSpeed = 0;
    for (var i = 0; i < myPokemon.length; i++) {
      OwnSpeed = myPokemon[i].stats.spe;
      if(myPokemon[i].active && !(myPokemon[i].fainted)){
        if(!myPokemon[i].modStats)
          UpdateInfo();
        if(myPokemon[i].modStats)
          OwnSpeed = myPokemon[i].modStats.spe;
      }
      room.myPokemon[i].speedTier = getSpeedTier(OwnSpeed,EnemySpeedMin,EnemySpeed);
    }
  }
}
function geteTable(pokemon){
  if(!pokemon.damageTaken)
    UpdateInfo();
  return pokemon.damageTaken;
}
//UTILS---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

//Returns the speed of a compared with b
//0 slower, 1 don't know, 2 faster
function getSpeedTier(a,bmin,bmax){
  if(a>bmax) return 2;
  if(a<bmin) return 0;
  return 1;
}
function getDamageChart(ptypes) {
  var t = typechart[ptypes[0]].damageTaken;
  if (ptypes.length > 1) {
    var n = {};
    var t2 = typechart[ptypes[1]].damageTaken;
    for (var key in t) {
        n[key] = t[key]*t2[key];
    }
    n.types = ptypes;
   return n;
  }
  return t;
}
//my pokemon can be a pokemons with stats or the theorized speed of an unknown user
function getModStats(pokemon,myPokemon){
  if(!myPokemon.stats){
    var num = myPokemon;
    myPokemon = {};
    myPokemon.stats= {spe: num};
    myPokemon.item= pokemon.item;
    myPokemon.types = pokemon.types;
  }
  return room.tooltips.calculateModifiedStats(pokemon,myPokemon);
}
//GUI---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
function UpdateMoveButtons() {
  $('.movemenu button').each(function () {
    var $this = $(this);
    var move = Tools.getMove($this.data('move'));
    if (move.target!= 'self' && move.category !== 'Status' && $this.find('.multiplier').length===0) {
      $type = $this.children('small.type');
      var bonus = [];
      for(var active of room.battle.sides[1].active){
        if(active)
         bonus.push(geteTable(active)[$type.text()]);
      }
      for(var bon of bonus){
        $type.after('<small class="multiplier" style="color:' + colormap[bon] + '">x' + bon + '</small> ');
      }
    }
  });
}
function UpdateSwitchButtons() {
  for (var i = 0; i < room.myPokemon.length; i++) {
    if (i === 0 && room.myPokemon[i].speedTier === undefined) {
      checkFastest();
    }
    if (!room.myPokemon[i].active) { //not active
      $('.switchmenu > button:nth-child(' + (i + 1) + ')').css('color', ['darkred','black','royalblue'][room.myPokemon[i].speedTier]);
    } else {
      $('div.rstatbar > div:nth-child(2) > div:nth-child(1)').css('color', ['lightcoral','white','lightblue'][room.myPokemon[i].speedTier]);
      //The enemy is going to have the reverse of the active pokemon
      $('div.lstatbar > div:nth-child(2) > div:nth-child(1)').css('color', ['lightcoral','white','lightblue'][2-room.myPokemon[i].speedTier]); 
    }
  }
}


//Called when a battle is found
function loadBattle() {
  if(room.battle.gen < 4) return; //Who plays older gens anyway
  //Custom wrap some functions
  var originalupdate = room.updateControlsForPlayer;
  room.updateControlsForPlayer = function () {
    var ret = originalupdate.apply(room, arguments);
    UpdateMoveButtons();
    UpdateSwitchButtons();
    return ret;
  };
  var originalTurn = room.battle.setTurn;
  room.battle.setTurn = function () {
    var ret = originalTurn.apply(room.battle, arguments);
    if(room.choiceData)
     originalupdate.apply(room);
    UpdateInfo();
    checkFastest();
    return ret;
  };
  
  //The next functions are calculated normally and then the output is modified to add more information.
  //this is a way too keep this addon from interfering with normal showdown updates.
  var originalMoveTooltip = BattleTooltips.prototype.showMoveTooltip;
  BattleTooltips.prototype.showMoveTooltip = function () {
    var text = originalMoveTooltip.apply(this, arguments);
    var move = arguments[0];
    var visEnemies = this.battle.yourSide.active;
    var pokemon = this.battle.mySide.active[this.room.choice.choices.length];
    
    var modBasePower = [];
      for(var enemy of visEnemies){
        if(enemy){
         var basePower = parseInt(this.getMoveBasePower(move, pokemon, enemy));
          if(basePower){
            modBasePower.push('('+(basePower * geteTable(enemy)[move.type] * ((move.type == pokemon.types[0] || move.type == pokemon.types[1]) ? 1.5 : 1))+')'); //stab
          } 
        }
      }
      text=text.replace(/<p>Base power: (\d+)\s?(\(\D*\))?\s?<\/p>/,"<p>Base power: \$1 "+modBasePower.reverse()+" \$2</p>");
    
    return text;
  };
  var originalPokeTooltip = BattleTooltips.prototype.showPokemonTooltip;
  BattleTooltips.prototype.showPokemonTooltip = function () {
    var text = originalPokeTooltip.apply(this, arguments);    
    pokemon = arguments[0];
    myPokemon = arguments[1] ;
    isActive = arguments[2];
    var spds = /(\d+) to (\d+) Spe/.exec(text);
    var visEnemy= room.battle.sides[1].active;
    var visFriend= room.battle.sides[0].active;
    if(spds){
      if(pokemon.minStats && spds[1]!= pokemon.minStats.spe)
        text= text.replace(/(\d+) to (\d+) Spe/, "\$1("+pokemon.minStats.spe+") to \$2("+pokemon.maxStats.spe+") Spe");
    }
    if(myPokemon && !isActive){
      if(visFriend){
        for(var i = 0;i<myPokemon.moves.length;i++){
          var move =Tools.getMove(myPokemon.moves[i]);
          if(move.target !=='self' && move.category!== 'Status' && visEnemy){
            var mult = [];
            for(var enemy of visEnemy){
              if(enemy){
                var bonus = geteTable(enemy)[move.type];
                mult.push(('<span style="color: '+colormap[bonus]+'"> x'+bonus+'</span>'));
              }
            }
            var name = move.name;
            var re = new RegExp("&#8226; "+name+".*?<br","g");
            text= text.replace(re,"&#8226; "+name+mult.reverse()+'<br');
          }
        }
      }
    }else if(!myPokemon){
      if(visFriend){
        for(var i = 0;i<pokemon.moveTrack.length;i++){
          var move =Tools.getMove(pokemon.moveTrack[i][0]);
          if(move.target !=='self' && move.category!== 'Status' && visFriend){
            var mult = [];
            for(var friend of visFriend){
              if(friend){
                var bonus = geteTable(friend)[move.type];
                mult.push(('<span style="color: '+colormap[bonus]+'"> x'+bonus+'</span>'));
              }
            }
            var name = move.name;
            var re = new RegExp("&#8226; "+name+".*?<br","g");
            text= text.replace(re,"&#8226; "+name+mult+'<br');
          }
        }
      }
    }
    if(pokemon.baseStats){
      //Add base Stats
      text =text.replace(/modifiers\)<\/p>.*?(<p class=|<\/div>)/,
                         'modifiers)</p><p>BaseStats:'+ pokemon.baseStats.atk + '&nbsp;Atk /&nbsp;' +
                         pokemon.baseStats.def + '&nbsp;Def /&nbsp;' +
                         pokemon.baseStats.spa + '&nbsp;SpA /&nbsp;' + 
                         pokemon.baseStats.spd + '&nbsp;SpD /&nbsp;'+
                         pokemon.baseStats.spe + '&nbsp;Spe</p>\$1');
   }
   return text;
  };

  BattleTooltips.prototype.showTooltip = function (thing, type, elem, ownHeight) {
		var room = this.room;

		var text = '';
		switch (type) {
		case 'move':
			var move = Tools.getMove(thing);
			if (!move) return;
			text = this.showMoveTooltip(move);
			break;

		case 'pokemon':
			var side = room.battle[thing.slice(0, -1) + "Side"];
			var pokemon = side.active[thing.slice(-1)];
			if (!pokemon) return;
			/* falls through */
    case 'enemysidepokemon':
        if(!pokemon){
          var pokemon = room.battle.sides[1].pokemon[parseInt(thing,10)];
        }
			 /* falls through */
	  case 'sidepokemon':
			var myPokemon;
			var isActive = (type === 'pokemon');
			if (room.myPokemon) {
				if (!pokemon) {
					myPokemon = room.myPokemon[parseInt(thing, 10)];
					pokemon = myPokemon;
				} else if (room.controlsShown && pokemon.side === room.battle.mySide) {
					// battlePokemon = pokemon;
					myPokemon = room.myPokemon[pokemon.slot];
				}
			}
			text = this.showPokemonTooltip(pokemon, myPokemon, isActive);
			break;
		}

		var offset = {
			left: 150,
			top: 500
		};
		if (elem) offset = $(elem).offset();
		var x = offset.left - 2;
		if (elem) {
			if (ownHeight) offset = $(elem).offset();
			else offset = $(elem).parent().offset();
		}
		var y = offset.top - 5;

		if (x > room.leftWidth + 335) x = room.leftWidth + 335;
		if (y < 140) y = 140;
		if (x > $(window).width() - 303) x = Math.max($(window).width() - 303, 0);

		if (!$('#tooltipwrapper').length) $(document.body).append('<div id="tooltipwrapper" onclick="$(\'#tooltipwrapper\').html(\'\');"></div>');
		$('#tooltipwrapper').css({
			left: x,
			top: y
		});
		$('#tooltipwrapper').html(text).appendTo(document.body);
		if (elem) {
			var height = $('#tooltipwrapper .tooltip').height();
			if (height > y) {
				y += height + 10;
				if (ownHeight) y += $(elem).height();
				else y += $(elem).parent().height();
				$('#tooltipwrapper').css('top', y);
			}
		}
	};
  room.battle.message('Custom Script Loaded');
}
function loadIcons(){
  $(".rightbar .pokemonicon").hover(function(){ //Enemy team icons
    if(this.title!== "Not revealed"){
      //plus 3 * parent because they are split in two divs of 3
      BattleTooltips.showTooltipFor(room.id,$(this).index()+(($(this).parent().index()-2) *3),'enemysidepokemon', this, false);
    }
  },BattleTooltips.hideTooltip);
}
//DATA----------------
const colormap = {
  0: '#101010',
  0.25: '#CC0000',
  0.5: '#990033',
  1: '',
  2: '#336633',
  4: 'green',
};
const typechart = {
  'Bug': {
    damageTaken: {
      'Bug': 1,
      'Dark': 1,
      'Dragon': 1,
      'Electric': 1,
      'Fairy': 1,
      'Fighting': 0.5,
      'Fire': 2,
      'Flying': 2,
      'Ghost': 1,
      'Grass': 0.5,
      'Ground': 0.5,
      'Ice': 1,
      'Normal': 1,
      'Poison': 1,
      'Psychic': 1,
      'Rock': 2,
      'Steel': 1,
      'Water': 1,
      'types': 'Bug',
    },
  },
  'Dark': {
    damageTaken: {
      'Bug': 2,
      'Dark': 0.5,
      'Dragon': 1,
      'Electric': 1,
      'Fairy': 2,
      'Fighting': 2,
      'Fire': 1,
      'Flying': 1,
      'Ghost': 0.5,
      'Grass': 1,
      'Ground': 1,
      'Ice': 1,
      'Normal': 1,
      'Poison': 1,
      'Psychic': 0,
      'Rock': 1,
      'Steel': 1,
      'Water': 1,
      'types': 'Dark',
    },
  },
  'Dragon': {
    damageTaken: {
      'Bug': 1,
      'Dark': 1,
      'Dragon': 2,
      'Electric': 0.5,
      'Fairy': 2,
      'Fighting': 1,
      'Fire': 0.5,
      'Flying': 1,
      'Ghost': 1,
      'Grass': 0.5,
      'Ground': 1,
      'Ice': 2,
      'Normal': 1,
      'Poison': 1,
      'Psychic': 1,
      'Rock': 1,
      'Steel': 1,
      'Water': 0.5,
      'types': 'Dragon',
    },
  },
  'Electric': {
    damageTaken: {
      'Bug': 1,
      'Dark': 1,
      'Dragon': 1,
      'Electric': 0.5,
      'Fairy': 1,
      'Fighting': 1,
      'Fire': 1,
      'Flying': 0.5,
      'Ghost': 1,
      'Grass': 1,
      'Ground': 2,
      'Ice': 1,
      'Normal': 1,
      'Poison': 1,
      'Psychic': 1,
      'Rock': 1,
      'Steel': 0.5,
      'Water': 1,
      'types': 'Electric',
    },
  },
  'Fairy': {
    damageTaken: {
      'Bug': 0.5,
      'Dark': 0.5,
      'Dragon': 0,
      'Electric': 1,
      'Fairy': 1,
      'Fighting': 0.5,
      'Fire': 1,
      'Flying': 1,
      'Ghost': 1,
      'Grass': 1,
      'Ground': 1,
      'Ice': 1,
      'Normal': 1,
      'Poison': 2,
      'Psychic': 1,
      'Rock': 1,
      'Steel': 2,
      'Water': 1,
      'types': 'Fairy',
    },
  },
  'Fighting': {
    damageTaken: {
      'Bug': 0.5,
      'Dark': 0.5,
      'Dragon': 1,
      'Electric': 1,
      'Fairy': 2,
      'Fighting': 1,
      'Fire': 1,
      'Flying': 2,
      'Ghost': 1,
      'Grass': 1,
      'Ground': 1,
      'Ice': 1,
      'Normal': 1,
      'Poison': 1,
      'Psychic': 2,
      'Rock': 0.5,
      'Steel': 1,
      'Water': 1,
      'types': 'Fighting',
    },
  },
  'Fire': {
    damageTaken: {
      'Bug': 0.5,
      'Dark': 1,
      'Dragon': 1,
      'Electric': 1,
      'Fairy': 0.5,
      'Fighting': 1,
      'Fire': 0.5,
      'Flying': 1,
      'Ghost': 1,
      'Grass': 0.5,
      'Ground': 2,
      'Ice': 0.5,
      'Normal': 1,
      'Poison': 1,
      'Psychic': 1,
      'Rock': 2,
      'Steel': 0.5,
      'Water': 2,
      'types': 'Fire',
    },
  },
  'Flying': {
    damageTaken: {
      'Bug': 0.5,
      'Dark': 1,
      'Dragon': 1,
      'Electric': 2,
      'Fairy': 1,
      'Fighting': 0.5,
      'Fire': 1,
      'Flying': 1,
      'Ghost': 1,
      'Grass': 0.5,
      'Ground': 0,
      'Ice': 2,
      'Normal': 1,
      'Poison': 1,
      'Psychic': 1,
      'Rock': 2,
      'Steel': 1,
      'Water': 1,
      'types': 'Flying',
    },
  },
  'Ghost': {
    damageTaken: {
      'Bug': 0.5,
      'Dark': 2,
      'Dragon': 1,
      'Electric': 1,
      'Fairy': 1,
      'Fighting': 0,
      'Fire': 1,
      'Flying': 1,
      'Ghost': 2,
      'Grass': 1,
      'Ground': 1,
      'Ice': 1,
      'Normal': 0,
      'Poison': 0.5,
      'Psychic': 1,
      'Rock': 1,
      'Steel': 1,
      'Water': 1,
      'types': 'Ghost',
    },
  },
  'Grass': {
    damageTaken: {
      'Bug': 2,
      'Dark': 1,
      'Dragon': 1,
      'Electric': 0.5,
      'Fairy': 1,
      'Fighting': 1,
      'Fire': 2,
      'Flying': 2,
      'Ghost': 1,
      'Grass': 0.5,
      'Ground': 0.5,
      'Ice': 2,
      'Normal': 1,
      'Poison': 2,
      'Psychic': 1,
      'Rock': 1,
      'Steel': 1,
      'Water': 0.5,
      'types': 'Grass',
    },
  },
  'Ground': {
    damageTaken: {
      'Bug': 1,
      'Dark': 1,
      'Dragon': 1,
      'Electric': 0,
      'Fairy': 1,
      'Fighting': 1,
      'Fire': 1,
      'Flying': 1,
      'Ghost': 1,
      'Grass': 2,
      'Ground': 1,
      'Ice': 2,
      'Normal': 1,
      'Poison': 0.5,
      'Psychic': 1,
      'Rock': 0.5,
      'Steel': 1,
      'Water': 2,
      'types': 'Ground',
    },
  },
  'Ice': {
    damageTaken: {
      'Bug': 1,
      'Dark': 1,
      'Dragon': 1,
      'Electric': 1,
      'Fairy': 1,
      'Fighting': 2,
      'Fire': 2,
      'Flying': 1,
      'Ghost': 1,
      'Grass': 1,
      'Ground': 1,
      'Ice': 0.5,
      'Normal': 1,
      'Poison': 1,
      'Psychic': 1,
      'Rock': 2,
      'Steel': 2,
      'Water': 1,
      'types': 'Ice',
    },
  },
  'Normal': {
    damageTaken: {
      'Bug': 1,
      'Dark': 1,
      'Dragon': 1,
      'Electric': 1,
      'Fairy': 1,
      'Fighting': 2,
      'Fire': 1,
      'Flying': 1,
      'Ghost': 0,
      'Grass': 1,
      'Ground': 1,
      'Ice': 1,
      'Normal': 1,
      'Poison': 1,
      'Psychic': 1,
      'Rock': 1,
      'Steel': 1,
      'Water': 1,
      'types': 'Normal',
    },
  },
  'Poison': {
    damageTaken: {
      'Bug': 0.5,
      'Dark': 1,
      'Dragon': 1,
      'Electric': 1,
      'Fairy': 0.5,
      'Fighting': 0.5,
      'Fire': 1,
      'Flying': 1,
      'Ghost': 1,
      'Grass': 0.5,
      'Ground': 2,
      'Ice': 1,
      'Normal': 1,
      'Poison': 0.5,
      'Psychic': 2,
      'Rock': 1,
      'Steel': 1,
      'Water': 1,
      'types': 'Poison',
    },
  },
  'Psychic': {
    damageTaken: {
      'Bug': 2,
      'Dark': 2,
      'Dragon': 1,
      'Electric': 1,
      'Fairy': 1,
      'Fighting': 0.5,
      'Fire': 1,
      'Flying': 1,
      'Ghost': 2,
      'Grass': 1,
      'Ground': 1,
      'Ice': 1,
      'Normal': 1,
      'Poison': 1,
      'Psychic': 0.5,
      'Rock': 1,
      'Steel': 1,
      'Water': 1,
      'types': 'Psychic',
    },
  },
  'Rock': {
    damageTaken: {
      'Bug': 1,
      'Dark': 1,
      'Dragon': 1,
      'Electric': 1,
      'Fairy': 1,
      'Fighting': 2,
      'Fire': 0.5,
      'Flying': 0.5,
      'Ghost': 1,
      'Grass': 2,
      'Ground': 2,
      'Ice': 1,
      'Normal': 0.5,
      'Poison': 0.5,
      'Psychic': 1,
      'Rock': 1,
      'Steel': 2,
      'Water': 2,
      'types': 'Rock',
    },
  },
  'Steel': {
    damageTaken: {
      'Bug': 0.5,
      'Dark': 1,
      'Dragon': 0.5,
      'Electric': 1,
      'Fairy': 0.5,
      'Fighting': 2,
      'Fire': 2,
      'Flying': 0.5,
      'Ghost': 1,
      'Grass': 0.5,
      'Ground': 2,
      'Ice': 0.5,
      'Normal': 0.5,
      'Poison': 0,
      'Psychic': 0.5,
      'Rock': 0.5,
      'Steel': 0.5,
      'Water': 1,
      'types': 'Steel',
    },
  },
  'Water': {
    damageTaken: {
      'Bug': 1,
      'Dark': 1,
      'Dragon': 1,
      'Electric': 2,
      'Fairy': 1,
      'Fighting': 1,
      'Fire': 0.5,
      'Flying': 1,
      'Ghost': 1,
      'Grass': 2,
      'Ground': 1,
      'Ice': 0.5,
      'Normal': 1,
      'Poison': 1,
      'Psychic': 1,
      'Rock': 1,
      'Steel': 0.5,
      'Water': 0.5,
      'types': 'Water',
    },
  },
};
//This calls loadIcons multiple times, but we can take the performance hit.
waitForKeyElements('.teamicons', loadIcons);
waitForKeyElements('.battle', loadBattle);