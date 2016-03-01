// ==UserScript==
// @name        Showdown Compound Eyes
// @description This script adds information to pokemon showdown single battles.
// @namespace   https://github.com/caiclone
// @include   http://play.pokemonshowdown.com/*
// @version     1.1
// @require  https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant       none
// ==/UserScript==

//Adds or updates(if needed) the damageTaken variable on every pokemon in the battle
function UpdateTypesTable() {
  for (var i = 0; i < 2; i++) {
    var p = room.battle.sides[i].active[0];
    if (p.damageTaken === undefined || p.damageTaken["types"] != p.types) {
      p.damageTaken = getDamageChart(p.types);
    }
  }
}
//Doesn't take into account items, assumes max IV, abilities or paralized
function checkFastest() {
  var myPokemon = room.myPokemon;
  var enemy = room.battle.sides[1].active[0];
  if (myPokemon != undefined && enemy!=null) {
    const EnemySpeed = getBoosted(room.tooltips.getTemplateMaxSpeed(enemy, enemy.level),enemy.boosts.spe);
    const EnemySpeedMin = getBoosted(room.tooltips.getTemplateMinSpeed(enemy, enemy.level),enemy.boosts.spe);
    var OwnSpeed = 0;
    for (var i = 0; i < myPokemon.length; i++) {
      OwnSpeed = myPokemon[i].stats['spe'];
      if(myPokemon[i].active && !(myPokemon[i].fainted)){
        OwnSpeed = getBoosted(OwnSpeed,room.battle.sides[0].active[0].boosts.spe);
      }
      room.myPokemon[i].speedTier = getSpeedTier(OwnSpeed,EnemySpeedMin,EnemySpeed);
    }
  }
}
//UTILS-------------------------------------

//Returns the speed of a compared with b
//0 slower, 1 don't know,2 faster
function getSpeedTier(a,bmin,bmax){
  if(a>bmax) return 2;
  if(a<bmin) return 0;
  return 1;
}
function getDamageChart(types) {
  var t = typechart[types[0]].damageTaken;
  if (types.length > 1) {
    var n = {};
    var t2 = typechart[types[1]].damageTaken;
    for (var key in t) {
        n[key] = t[key]*t2[key];
    }
    n["types"] = types;
   return n;
  }
  return t;
}

function getBoosted(stat,boostLvl){
  if(boostLvl>0) return stat*((2+(boostLvl||0))/2);
  return Math.round(stat*(2/(2-(boostLvl||0))));
}
//GUI---------------------------------------
function UpdateMoveButtons() {
  $('.movemenu').children('button').each(function () {
    var $this = $(this);
    var move = Tools.getMove($this.data('move'));
    if (move.target!= 'self' && move.category !== 'Status' && $this.find('.multiplier').length==0) {
      $type = $this.children('small.type');
      var bonus = room.battle.sides[1].active[0].damageTaken[$type.text()];
      $type.after('<small class="multiplier" style="color:' + colormap[bonus] + '">x' + bonus + '</small>');
    }
  });
}
function UpdateSwitchButtons() {
  for (var i = 0; i < room.myPokemon.length; i++) {
    if (i == 0 && room.myPokemon[i].speedTier == undefined) {
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
    originalupdate.apply(room, []);
    UpdateMoveButtons();
    UpdateSwitchButtons();
  }
  var originalTurn = room.battle.setTurn;
  room.battle.setTurn = function (tn) {
    originalTurn.apply(room.battle, [tn]);
    UpdateTypesTable();
    checkFastest();
  }
  //Functions from showdown original client, copy pasted and modified to add new features.
  BattleTooltips.prototype.showMoveTooltip = function (move) {
    var text = '';
    var basePower = move.basePower;
    var basePowerText = '';
    var additionalInfo = '';
    var yourActive = this.battle.yourSide.active;
    var pokemon = this.battle.mySide.active[this.room.choice.choices.length];
    var myPokemon = this.room.myPokemon[pokemon.slot];
    // Check if there are more than one active Pokemon to check for multiple possible BPs.
    if (yourActive.length > 1) {
      // We check if there is a difference in base powers to note it.
      // Otherwise, it is just shown as in singles.
      // The trick is that we need to calculate it first for each Pokemon to see if it changes.
      var previousBasepower = false;
      var difference = false;
      var basePowers = [
      ];
      for (var i = 0; i < yourActive.length; i++) {
        if (!yourActive[i]) continue;
        basePower = this.getMoveBasePower(move, pokemon, yourActive[i]);
        if (previousBasepower === false) previousBasepower = basePower;
        if (previousBasepower !== basePower) difference = true;
        if (!basePower) basePower = '&mdash;';
        basePowers.push('Base power for ' + yourActive[i].name + ': ' + basePower);
      }
      if (difference) {
        basePowerText = '<p>' + basePowers.join('<br />') + '</p>';
      }
      // Falls through to not to repeat code on showing the base power.

    }
    if (!basePowerText) {
      var activeTarget = yourActive[0] || yourActive[1] || yourActive[2];
      basePower = this.getMoveBasePower(move, pokemon, activeTarget) || basePower;
      if (!basePower) {
        basePowerText = '<p>Base power: ?</p>';
      } else {
        var modBasePower = basePower * activeTarget.damageTaken[move.type] * ((move.type == pokemon.types[0] || move.type == pokemon.types[1]) ? 1.5 : 1); //stab
        basePowerText = '<p>Base power: ' + basePower + '(' + modBasePower + ')</p>';
      }
    }
    var accuracy = move.accuracy;
    if (this.battle.gen < 6) {
      var table = BattleTeambuilderTable['gen' + this.battle.gen];
      if (move.id in table.overrideAcc) basePower = table.overrideAcc[move.id];
    }
    if (!accuracy || accuracy === true) accuracy = '&mdash;';
     else accuracy = '' + accuracy + '%';
    // Handle move type for moves that vary their type.
    var moveType = this.getMoveType(move, pokemon);
    // Deal with Nature Power special case, indicating which move it calls.
    if (move.id === 'naturepower') {
      if (this.battle.gen === 6) {
        additionalInfo = 'Calls ';
        if (this.battle.hasPseudoWeather('Electric Terrain')) {
          additionalInfo += Tools.getTypeIcon('Electric') + ' Thunderbolt';
        } else if (this.battle.hasPseudoWeather('Grassy Terrain')) {
          additionalInfo += Tools.getTypeIcon('Grass') + ' Energy Ball';
        } else if (this.battle.hasPseudoWeather('Misty Terrain')) {
          additionalInfo += Tools.getTypeIcon('Fairy') + ' Moonblast';
        } else {
          additionalInfo += Tools.getTypeIcon('Normal') + ' Tri Attack';
        }
      } else if (this.battle.gen > 3) {
        // In gens 4 and 5 it calls Earthquake.
        additionalInfo = 'Calls ' + Tools.getTypeIcon('Ground') + ' Earthquake';
      } else {
        // In gen 3 it calls Swift, so it retains its normal typing.
        additionalInfo = 'Calls ' + Tools.getTypeIcon('Normal') + ' Swift';
      }
    }
    text = '<div class="tooltipinner"><div class="tooltip">';
    var category = move.category;
    if (this.battle.gen <= 3 && move.category !== 'Status') {
      category = (move.type in {
        Fire: 1,
        Water: 1,
        Grass: 1,
        Electric: 1,
        Ice: 1,
        Psychic: 1,
        Dark: 1,
        Dragon: 1
      }
      ? 'Special' : 'Physical');
    }
    text += '<h2>' + move.name + '<br />' + Tools.getTypeIcon(moveType) + ' <img src="' + Tools.resourcePrefix;
    text += 'sprites/categories/' + category + '.png" alt="' + category + '" /></h2>';
    text += basePowerText;
    if (additionalInfo) text += '<p>' + additionalInfo + '</p>';
    text += '<p>Accuracy: ' + accuracy + '</p>';
    if (move.desc) {
      if (this.battle.gen < 6) {
        var desc = move.shortDesc;
        for (var i = this.battle.gen; i < 6; i++) {
          if (move.id in BattleTeambuilderTable['gen' + i].overrideMoveDesc) {
            desc = BattleTeambuilderTable['gen' + i].overrideMoveDesc[move.id];
            break;
          }
        }
        text += '<p class="section">' + desc + '</p>';
      } else {
        text += '<p class="section">';
        if (move.priority > 1) {
          text += 'Nearly always moves first <em>(priority +' + move.priority + ')</em>.</p><p>';
        } else if (move.priority <= - 1) {
          text += 'Nearly always moves last <em>(priority &minus;' + ( - move.priority) + ')</em>.</p><p>';
        } else if (move.priority == 1) {
          text += 'Usually moves first <em>(priority +' + move.priority + ')</em>.</p><p>';
        }
        text += '' + (move.desc || move.shortDesc) + '</p>';
        if ('defrost' in move.flags) {
          text += '<p class="movetag">The user thaws out if it is frozen.</p>';
        }
        if (!('protect' in move.flags) && move.target !== 'self' && move.target !== 'allySide' && move.target !== 'allyTeam') {
          text += '<p class="movetag">Bypasses Protect <small>(and Detect, King\'s Shield, Spiky Shield)</small></p>';
        }
        if ('authentic' in move.flags) {
          text += '<p class="movetag">Bypasses Substitute <small>(but does not break it)</small></p>';
        }
        if (!('reflectable' in move.flags) && move.target !== 'self' && move.target !== 'allySide' && move.target !== 'allyTeam' && move.category === 'Status') {
          text += '<p class="movetag">&#x2713; Not bounceable <small>(can\'t be bounced by Magic Coat/Bounce)</small></p>';
        }
        if ('contact' in move.flags) {
          text += '<p class="movetag">&#x2713; Contact <small>(triggers Iron Barbs, Spiky Shield, etc)</small></p>';
        }
        if ('sound' in move.flags) {
          text += '<p class="movetag">&#x2713; Sound <small>(doesn\'t affect Soundproof pokemon)</small></p>';
        }
        if ('powder' in move.flags) {
          text += '<p class="movetag">&#x2713; Powder <small>(doesn\'t affect Grass, Overcoat, Safety Goggles)</small></p>';
        }
        if ('punch' in move.flags && (myPokemon.baseAbility === 'ironfist' || pokemon.ability === 'Iron Fist')) {
          text += '<p class="movetag">&#x2713; Fist <small>(boosted by Iron Fist)</small></p>';
        }
        if ('pulse' in move.flags && (myPokemon.baseAbility === 'megalauncher' || pokemon.ability === 'Mega Launcher')) {
          text += '<p class="movetag">&#x2713; Pulse <small>(boosted by Mega Launcher)</small></p>';
        }
        if ('bite' in move.flags && (myPokemon.baseAbility === 'strongjaw' || pokemon.ability === 'Strong Jaw')) {
          text += '<p class="movetag">&#x2713; Bite <small>(boosted by Strong Jaw)</small></p>';
        }
        if ('bullet' in move.flags) {
          text += '<p class="movetag">&#x2713; Ballistic <small>(doesn\'t affect Bulletproof pokemon)</small></p>';
        }
        if (this.battle.gameType === 'doubles') {
          if (move.target === 'allAdjacent') {
            text += '<p class="movetag">&#x25ce; Hits both foes and ally.</p>';
          } else if (move.target === 'allAdjacentFoes') {
            text += '<p class="movetag">&#x25ce; Hits both foes.</p>';
          }
        } else if (this.battle.gameType === 'triples') {
          if (move.target === 'allAdjacent') {
            text += '<p class="movetag">&#x25ce; Hits adjacent foes and allies.</p>';
          } else if (move.target === 'allAdjacentFoes') {
            text += '<p class="movetag">&#x25ce; Hits adjacent foes.</p>';
          } else if (move.target === 'any') {
            text += '<p class="movetag">&#x25ce; Can target distant Pok&eacute;mon in Triples.</p>';
          }
        }
      }
    }
    text += '</div></div>';
    return text;
  };
  BattleTooltips.prototype.showPokemonTooltip = function (pokemon, myPokemon, isActive) {
    var text = '';
    var gender = '';
    if (pokemon.gender === 'F') gender = ' <small style="color:#C57575">&#9792;</small>';
    if (pokemon.gender === 'M') gender = ' <small style="color:#7575C0">&#9794;</small>';
    text = '<div class="tooltipinner"><div class="tooltip">';
    text += '<h2>' + pokemon.getFullName() + gender + (pokemon.level !== 100 ? ' <small>L' + pokemon.level + '</small>' : '') + '<br />';
    var template = pokemon;
    if (!pokemon.types) template = Tools.getTemplate(pokemon.species);
    if (pokemon.volatiles && pokemon.volatiles.transform && pokemon.volatiles.formechange) {
      template = Tools.getTemplate(pokemon.volatiles.formechange[2]);
      text += '<small>(Transformed into ' + pokemon.volatiles.formechange[2] + ')</small><br />';
    } else if (pokemon.volatiles && pokemon.volatiles.formechange) {
      template = Tools.getTemplate(pokemon.volatiles.formechange[2]);
      text += '<small>(Forme: ' + pokemon.volatiles.formechange[2] + ')</small><br />';
    }
    var types = template.types;
    var gen = this.battle.gen;
    if (gen < 5 && template.baseSpecies === 'Rotom') {
      types = [
        'Electric',
        'Ghost'
      ];
    } else if (gen < 2 && types[1] === 'Steel') {
      types = [
        types[0]
      ];
    } else if (gen < 6 && types[0] === 'Fairy' && types.length > 1) {
      types = [
        'Normal',
        types[1]
      ];
    } else if (gen < 6 && types[0] === 'Fairy') {
      types = [
        'Normal'
      ];
    } else if (gen < 6 && types[1] === 'Fairy') {
      types = [
        types[0]
      ];
    }
    var isTypeChanged = false;
    if (pokemon.volatiles && pokemon.volatiles.typechange) {
      isTypeChanged = true;
      types = pokemon.volatiles.typechange[2].split('/');
    }
    if (pokemon.volatiles && pokemon.volatiles.typeadd) {
      isTypeChanged = true;
      if (types && types.indexOf(pokemon.volatiles.typeadd[2]) === - 1) {
        types = types.concat(pokemon.volatiles.typeadd[2]);
      }
    }
    if (isTypeChanged) text += '<small>(Type changed)</small><br />';
    if (types) {
      text += types.map(Tools.getTypeIcon).join(' ');
    } else {
      text += 'Types unknown';
    }
    text += '</h2>';
    if (pokemon.fainted) {
      text += '<p>HP: (fainted)</p>';
    } else {
      var exacthp = '';
      if (myPokemon) exacthp = ' (' + myPokemon.hp + '/' + myPokemon.maxhp + ')';
       else if (pokemon.maxhp == 48) exacthp = ' <small>(' + pokemon.hp + '/' + pokemon.maxhp + ' pixels)</small>';
      text += '<p>HP: ' + pokemon.hpDisplay() + exacthp + (pokemon.status ? ' <span class="status ' + pokemon.status + '">' + pokemon.status.toUpperCase() + '</span>' : '') + '</p>';
    }
    var showOtherSees = isActive;
    if (myPokemon) {
      if (this.battle.gen > 2) {
        text += '<p>Ability: ' + Tools.getAbility(myPokemon.baseAbility).name;
        if (myPokemon.item) {
          text += ' / Item: ' + Tools.getItem(myPokemon.item).name;
        }
        text += '</p>';
      } else if (myPokemon.item) {
        text += '<p>Item: ' + Tools.getItem(myPokemon.item).name + '</p>';
      }
      if(isActive && pokemon.boosts){ //boosts
        text += '<p>' + myPokemon.stats['atk'];
        if(pokemon.boosts.atk) text += '('+getBoosted(myPokemon.stats['atk'],pokemon.boosts.atk)+')';
        text += '&nbsp;Atk /&nbsp;' + myPokemon.stats['def'];
        if(pokemon.boosts.def) text += '('+getBoosted(myPokemon.stats['def'],pokemon.boosts.def)+')';
        text += '&nbsp;Def /&nbsp;' + myPokemon.stats['spa'];
        if(pokemon.boosts.spa) text += '('+getBoosted(myPokemon.stats['spa'],pokemon.boosts.spa)+')';
        if (this.battle.gen === 1) {
          text += '&nbsp;Spc /&nbsp;';
        } else {
          text += '&nbsp;SpA /&nbsp;' + myPokemon.stats['spd'];
          if(pokemon.boosts.spd) text += '('+getBoosted(myPokemon.stats['spd'],pokemon.boosts.spd)+')';
          text+= '&nbsp;SpD /&nbsp;';
        }
        text += myPokemon.stats['spe'];
        if(pokemon.boosts.spe) text += '('+getBoosted(myPokemon.stats['spe'],pokemon.boosts.spe)+')';
        text += '&nbsp;Spe</p>';
      }else{
        text += '<p>' + myPokemon.stats['atk'] + '&nbsp;Atk /&nbsp;' + myPokemon.stats['def'] + '&nbsp;Def /&nbsp;' + myPokemon.stats['spa'];
        if (this.battle.gen === 1) {
          text += '&nbsp;Spc /&nbsp;';
        } else {
          text += '&nbsp;SpA /&nbsp;' + myPokemon.stats['spd'] + '&nbsp;SpD /&nbsp;';
        }
        text += myPokemon.stats['spe'] + '&nbsp;Spe</p>';
      }
      if(isActive){
        text+= '<p class="section">Opponent sees:</p>';
      }
    } else {
        showOtherSees = true;
    } 
    if (this.battle.gen > 2 && showOtherSees) {
      if (!pokemon.baseAbility && !pokemon.ability) {
        if (template.abilities) {
          text += '<p>Possible abilities: ' + Tools.getAbility(template.abilities['0']).name;
          if (template.abilities['1']) text += ', ' + Tools.getAbility(template.abilities['1']).name;
          if (this.battle.gen > 4 && template.abilities['H']) text += ', ' + Tools.getAbility(template.abilities['H']).name;
          text += '</p>';
        }
      } else if (pokemon.ability) {
        text += '<p>Ability: ' + Tools.getAbility(pokemon.ability).name + '</p>';
      } else if (pokemon.baseAbility) {
        text += '<p>Ability: ' + Tools.getAbility(pokemon.baseAbility).name + '</p>';
      }
    }
    if (showOtherSees) {
      var item = '';
      var itemEffect = pokemon.itemEffect || '';
      if (pokemon.prevItem) {
        item = 'None';
        if (itemEffect) itemEffect += '; ';
        var prevItem = Tools.getItem(pokemon.prevItem).name;
        itemEffect += pokemon.prevItemEffect ? prevItem + ' was ' + pokemon.prevItemEffect : 'was ' + prevItem;
      }
      if (pokemon.item) item = Tools.getItem(pokemon.item).name;
      if (itemEffect) itemEffect = ' (' + itemEffect + ')';
      if (item) text += '<p>Item: ' + item + itemEffect + '</p>';
      text += '<p>' + this.getTemplateMinSpeed(template, pokemon.level);
      if(pokemon.boosts && pokemon.boosts.spe) text+= '('+getBoosted(this.getTemplateMinSpeed(template,pokemon.level),pokemon.boosts.spe)+')';
      text +=' to ' + this.getTemplateMaxSpeed(template, pokemon.level);
      if(pokemon.boosts && pokemon.boosts.spe) text+= '('+getBoosted(this.getTemplateMaxSpeed(template,pokemon.level),pokemon.boosts.spe)+')';
      text += ' Spe (before items/abilities)</p>';
      if (pokemon.baseStats) {
        text += '<p>BaseStats:' + pokemon.baseStats['atk'] + '&nbsp;Atk /&nbsp;' +pokemon.baseStats['def'] + '&nbsp;Def /&nbsp;' +pokemon.baseStats['spa'];
        if (this.battle.gen === 1) {
          text += '&nbsp;Spc /&nbsp;';
        } else {
          text += '&nbsp;SpA /&nbsp;' + pokemon.baseStats['spd'] + '&nbsp;SpD /&nbsp;';
        }
        text += pokemon.baseStats['spe'] + '&nbsp;Spe</p>';
      }
    }
    if (myPokemon && !isActive) {
      var visibleEnemy = (room.battle.sides[1].active[0]);
      var eTable;
      if(visibleEnemy){
        eTable =room.battle.sides[1].active[0].damageTaken;
      }
      text += '<p class="section">';
      var battlePokemon = this.battle.getPokemon(pokemon.ident, pokemon.details);
      for (var i = 0; i < myPokemon.moves.length; i++) {
        var move = Tools.getMove(myPokemon.moves[i]);
        var name = move.name;
        var pp = 0,
        maxpp = 0;
        if (battlePokemon && battlePokemon.moveTrack) {
          for (var j = 0; j < battlePokemon.moveTrack.length; j++) {
            if (name === battlePokemon.moveTrack[j][0]) {
              name = this.getPPUseText(battlePokemon.moveTrack[j], true);
              break;
            }
          }
        }
        if(move.target !== 'self' && move.category!== 'Status' && visibleEnemy){
          var mult = eTable[move.type];
          text += '&#8226; ' + name +' <span style="color: '+colormap[mult]+'">x'+mult+'</span><br />';
        }else{
          text += '&#8226; ' + name +'<br />';
        }
      }
      text += '</p>';
    } else if (pokemon.moveTrack && pokemon.moveTrack.length) {
      var visibleEnemy = (pokemon.side.foe.active[0]);
      var eTable;
      if(visibleEnemy){
        eTable =pokemon.side.foe.active[0].damageTaken;
      }
      text += '<p class="section">';
      for (var i = 0; i < pokemon.moveTrack.length; i++) {
        var move = Tools.getMove(pokemon.moveTrack[i][0]);
        if(move.target !== 'self' && move.category!== 'Status' && visibleEnemy){
          var mult = eTable[move.type];
          text += '&#8226; ' + this.getPPUseText(pokemon.moveTrack[i]) +' <span style="color: '+colormap[mult]+'">x'+
            mult +'</span><br />';
        }else{
          text += '&#8226; ' + this.getPPUseText(pokemon.moveTrack[i]) +'<br />';
        }
      }
      text += '</p>';
    }
    text += '</div></div>';
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
      BattleTooltips.showTooltipFor(room.id,$(this).index()+(($(this).parent().index()-2) *3),'enemysidepokemon', this, false)
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
}
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