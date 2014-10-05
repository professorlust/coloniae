/*

graphics.js

*/

define(['jquery', 'three-stats', './graphics/framework', 'text!../imgs/atlas.json'], function($, Stats, framework, atlasJSON){
	return  new framework(new function(){
		this.cameraPosition = { x: 500, y: 0 };

		this.gameStarted = true;
		
		this.buildMode = false;
		this.removeMode = false;
		this.testBuilding = undefined;

		this.images = [ "atlas" ];
		var atlas = JSON.parse(atlasJSON);

		this.fullscreen = true;

		this.getTileOnScreen = function(x, y){
			if(tiles.size == undefined) // WTF
				return;

			var arr = [];

			for(var i = 0; i < tiles.size.x; i++){
				for(var j = 0; j < tiles.size.y; j++){
					var posX = this.cameraPosition.x + i * -32 + j * 32;
					var posY = this.cameraPosition.y + j * 16 + i * 16 - 16;

					if(tiles[i][j].terrainLevel >= 2)
						posY -= 20;

					if(	y >= (posY - 16) && y <= (posY + 16) &&
						x >= (posX - 32) && x <= (posX + 32) ){
						// magic :)
						function calcMagicDistance(ax, ay, bx, by){
							return Math.sqrt((ax - bx) * (ax - bx) / 2 + (ay - by) * (ay - by) * 2);
						}

						arr.push([calcMagicDistance(posX, posY, x, y), tiles.coords(i, j)]);
					}
				}
			}

			if(arr.length == 0)
				return undefined;

			arr.sort(function(a, b){
				return a[0] - b[0];
			});

			return tiles.at(arr[0][1]);
		}

		this.hoveredTile = undefined;

		var moveMap = false;
		var wasMoved = false;

		this.onMouseEnter = function(){};
		this.onMouseLeave = function(){
			this.hoveredTile = undefined;
			moveMap = false;
		};

		var oldX = undefined;
		var oldY = undefined;

		this.onMouseMove = function(x, y){
			oldX = oldX || x;
			oldY = oldY || y;

			this.hoveredTile = this.getTileOnScreen(x, y);

			if(moveMap){
				this.cameraPosition.x += (x - oldX);
				this.cameraPosition.y += (y - oldY);

				wasMoved = true;
			}

			if(this.buildMode && this.hoveredTile != undefined && this.testBuilding != undefined){
				this.testCanBe = canBeBuild(this.hoveredTile.x, this.hoveredTile.y, this.testBuilding);
			}

			oldX = x;
			oldY = y;
		};

		this.onMouseDown = function(x, y){
			moveMap = true;
			wasMoved = false;
		};

		this.clickHandler = function(){};

		this.onMouseUp = function(x, y){
			moveMap = false;

			if(!wasMoved){
				var clickedTile = this.getTileOnScreen(x, y);

				if(clickedTile != undefined){
					console.log("clicked tile (" + clickedTile.x + ", " + clickedTile.y + ")");

					var wasAnyAction = false;

					// budowa budynku
					if(this.buildMode && this.testBuilding != undefined){
						var structure = structsClass[this.testBuilding.__structId];

						var side = this.testBuilding.rotation;

						// if(structure.name == "Iron mine" || structure.name == "Quarry") // "quickfix"
						// 	side = WEST;

						new structure.class(clickedTile.x, clickedTile.y, countries[0], undefined, side);

						wasAnyAction = true;
					}

					// usunięcie budynku
					if(this.removeMode && clickedTile.buildingData != null){
						clickedTile.buildingData.remove();
						wasAnyAction = true;
					}

					if(!wasAnyAction)
						this.clickHandler(x, y);
				}
				else
					console.log("out of board click");
			}
		};

		this.onRender = function(delta, ctx, resources){
			ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

			var porters = {}; // [porterPosition] -> porterType

			// update porters positions to display
			for(var i = 0; i < civilianUnits.length; i++){
				var porter = civilianUnits[i];

				if(!(porter instanceof Porter))
					continue;

				if(porter.position.x != -1 && porter.position.y != -1 && porter.isBusy)
					porters[tiles.index(porter.position)] = (porter.origin instanceof Marketplace ? 1 : 2);
			}

			var screenSize = tiles.coords(ctx.canvas.width, ctx.canvas.height);
			var screenMarginSize = 100;

			var toDrawArray = [];

			var toDrawBuildings = {};
			var toDrawMoutains = {};

			var margin = 1;

			// TODO: rysować tylko widoczne tilesy...
			for(var x = -margin; x < tiles.size.x + margin; x++){
				for(var y = -margin; y < tiles.size.y + margin; y++){
					var posX = this.cameraPosition.x + x * -32 + y * 32;
					var posY = this.cameraPosition.y + y * 16 + x * 16;

					var outOfScreen = (posX < -screenMarginSize || posY < -screenMarginSize || posX > (screenSize.x + screenMarginSize) || posY > (screenSize.y + screenMarginSize));

					function drawRawAtlasTile(atlasName, mode){
						toDrawArray.push({
							atlasName: atlasName,
							x: x,
							y: y,
							screenX: posX,
							screenY: posY,
							isVisible: !outOfScreen,
							specialMode: _.clone(mode)
						});
					}

					function drawAtlasTile(atlasName, tile, mode){
						drawRawAtlasTile(atlasName, mode);

						if(tile != undefined){
							if(!outOfScreen && tile.buildingData != null)
								toDrawBuildings[tile.buildingData.structureId] = true;

							if(!outOfScreen && tile.terrainLevel >= HILLSIDE && tile.terrainType != undefined)
								toDrawMoutains[tiles.index(tile.terrainType)] = true;
						}
					}

					// ~~~

					if(!tiles.exsist(x, y)){
						if(!outOfScreen)
							drawAtlasTile("sea1", undefined);

						continue;
					}

					var tile = tiles[x][y];
					var tileImage = "";

					if(outOfScreen){
						if(!(tile.terrainLevel >= HILLSIDE ||
							(tile.buildingData != undefined && tile.buildingData.width > 1 && tile.buildingData.height > 1)))
							continue;
					}

					// (1) teren:

					function buildSpecialTileName(name, hash){
						function getTile(x, y){
							if(tiles[x] == undefined || tiles[x][y] == undefined)
								return (new Tile());

							return tiles[x][y];
						}

						return name +	"_" + hash(getTile(x + 1, y)) +
										"_" + hash(getTile(x, y + 1)) +
										"_" + hash(getTile(x - 1, y)) +
										"_" + hash(getTile(x, y - 1));
					}

					switch(tile.terrainLevel){
						case SEA:
								tileImage = "sea1";
							break;

						case SHALLOW:
								tileImage = buildSpecialTileName("shallow1", function(tile){
									switch(tile.terrainLevel){
										case 0: return 'h';
										case 1: return 'c';
										default: return 's';
									}
								});
							break;

						case COAST:
								tileImage = buildSpecialTileName("coast1", function(tile){
									switch(tile.terrainLevel){
										case 0: return 's';
										case 1: return 'c';
										default: return 'i';
									}
								});
							break;

						case PLAINS:
								tileImage = "grassland1";
							break;

						case HILLSIDE:
								tileImage = buildSpecialTileName("hillside1", function(tile){
									switch(tile.terrainLevel){
										case 3: return 'h';
										case 4: return 'm';
										default: return 'i';
									}
								});
							break;

						case MOUTAIN:
								var localX = x - tile.terrainType.x;
								var localY = y - tile.terrainType.y;

								tileImage = "moutain1_" + localX + "_" + localY;
							break;
					}

					// tilesy wyspy są na wyższym poziomie niż reszta :)
					if(tile.terrainLevel >= PLAINS)
						posY -= 20;

					// (2) budynek:

					function getBuildingImage(building, offset){
						var name = _.clone(building.structName).replace(/\s/g, '');
						name = name.toLowerCase();

						if(building instanceof House)
							name = name + (building.type + 1).toString(); // house<level>_...
						else
							name = name + building.rotation; // <buildingname><side>

						switch(building.structName){
							case "Road":
								return buildSpecialTileName(name, function(tile){
									return (tile.buildingData instanceof Road ? 'r' : 'n');
								});

							// TODO: zamienić "harbor1.png" na "harbor1_0_0.png" i nie będzie tego switcha...
							case "Harbor":
							case "Tree field":
							case "Grain field":
							case "Cocoa field":
							case "Sugarcane field":
							case "Wine field":
							case "Spice field":
							case "Tobacco field":
							case "Cotton field":
								return name;

							default:
								return name + "_" + offset.x + "_" + offset.y;
						}
					}

					var canBeOverwritten = true;

					if(tile.buildingData != null){
						tileImage = getBuildingImage(tile.buildingData, tile.buildingData.isUnder(tile));
						canBeOverwritten = tile.buildingData.canBeOverwritten;
					}

					// (3) ew. budynek testowego (budowanie budynku):

					if( this.buildMode && this.testBuilding != undefined &&
						this.hoveredTile != undefined && canBeOverwritten && tile.islandId != INVALID_ID ){
						var offsetX = Math.floor((this.testBuilding.width - 1) / 2);
						var offsetY = Math.floor((this.testBuilding.height - 1) / 2);

						var localX = x - this.hoveredTile.x + offsetX;
						var localY = y - this.hoveredTile.y + offsetY;

						if( localX >= 0 && localX < this.testBuilding.width &&
							localY >= 0 && localY < this.testBuilding.height ){
							// jeżeli można wybudować w danym miejscu to wyświetla się budynek,
							// jeśli nie to placeholder (by jakoś to wyglądało)
							if(this.testCanBe)
								tileImage = getBuildingImage(this.testBuilding, tiles.coords(localX, localY));
							else{
								if(tile.terrainLevel == this.testBuilding.requiredTerrainMap[localX][localY])
									tileImage = "placeholder_moutain";
							}
						}
					}

					// ~~~

					if(tileImage != undefined){
						drawAtlasTile(tileImage, tile);

						// special drawing for special modes:

						if((this.buildMode || this.removeMode) && tile.countryId != 0){
							drawAtlasTile(tileImage, tile, {
								"globalCompositeOperation": "multiply"
							});
						}

						if(this.hoveredTile != undefined &&
						   tiles.at(this.hoveredTile).buildingData != undefined &&
						   tiles.at(this.hoveredTile).buildingData == tile.buildingData){
							drawAtlasTile(tileImage, tile, {
								"globalCompositeOperation": "lighter",
								"globalAlpha": (this.removeMode ? 0.5 : 0.1)
							});
						}
					}

					// draw porter, if any
					if(porters[tile.index] != undefined)
						drawRawAtlasTile("placeholder_porter" + porters[tile.index]);
				}
			}

			for(var i = 0; i < toDrawArray.length; i++){
				function realDrawAtlasTile(atlasName, x, y, mode){
					var coords = atlas[atlasName];

					if(coords == undefined)
						return;

					// rysuje się zawsze od początku tilesa
					x = x - (coords.w / 2);
					y = y - coords.h;

					function drawImage(){
						ctx.drawImage(
							resources["atlas"],
							coords.x, coords.y, coords.w, coords.h,
							x, y, coords.w, coords.h
						);
					}

					if(mode == undefined)
						drawImage();
					else {
						ctx.save();

						for(var key in mode){
							ctx[key] = mode[key];
						}

						drawImage();

						ctx.restore();
					}
				}

				var item = toDrawArray[i];

				if(tiles.exsist(item.x, item.y)){
					var tile = tiles[item.x][item.y];

					if(tile != undefined){
						if(tile.buildingData != null &&
							!(tile.buildingData.structureId in toDrawBuildings))
							continue;

						if(tile.terrainLevel >= HILLSIDE && tile.terrainType != undefined &&
							!(tiles.index(tile.terrainType) in toDrawMoutains))
							continue;
					}
				}

				realDrawAtlasTile(item.atlasName, item.screenX, item.screenY, item.specialMode);
			}
		};

		this.timeFlowSpeed = 4;
		
		this.onUpdate = function(delta){
			if(this.gameStarted)
				update(delta, this.timeFlowSpeed);
		};
	});
});

var hardUpdateInterval = 1.0; // co sekundę
var hardUpdateCount = 0.0;
function update(delta, timeSpeed){
	hardUpdateCount += delta;
	while(hardUpdateCount >= hardUpdateInterval){
		// KOLEJNOŚĆ JEST WAŻNA - islands musi być pierwsze
		for(var i = 0; i < islands.length; i++){
			if(islands[i] != undefined)
				islands[i].hardUpdate(hardUpdateInterval * timeSpeed);
		}

		for(var i = 0; i < structures.length; i++){
			if(structures[i] != undefined)
				structures[i].hardUpdate(hardUpdateInterval * timeSpeed);
		}

		for(var i = 0; i < civilianUnits.length; i++){
			if(islands[i] != undefined)
				civilianUnits[i].hardUpdate(hardUpdateInterval * timeSpeed);
		}

		hardUpdateCount -= hardUpdateInterval;
	}

	for(var i = 0; i < islands.length; i++){
		if(islands[i] != undefined)
			islands[i].softUpdate(delta * timeSpeed);
	}

	for(var i = 0; i < structures.length; i++){
		if(structures[i] != undefined)
			structures[i].softUpdate(delta * timeSpeed);
	}

	for(var i = 0; i < civilianUnits.length; i++){
		if(civilianUnits[i] != undefined)
			civilianUnits[i].softUpdate(delta * timeSpeed);
	}
}