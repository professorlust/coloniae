/*

graphics.js

*/

KEY_ARROW_UP = 38;
KEY_ARROW_DOWN = 40;
KEY_ARROW_LEFT = 37;
KEY_ARROW_RIGHT = 39;

KEYBOARD_MOVE_MAP_DIFF = 20;

define(['underscore',
		'./graphics/framework',
		'./logic',
		'./graphics/gameplayState',
		'./graphics/drawMethod',
		'./graphics/tilePicker',
		'./graphics/layerManager'
		],
	function(
		_,
		framework,
		Logic,
		gameplayState,
		draw,
		picker,
		layerManager){

	var wasAnyAction = false;

	function makeClick(clickedTile, hoverTile, mouseX, mouseY){
		if(gameplayState.choosedSth instanceof Ship){
			if(clickedTile.terrainLevel < SHALLOW){
				console.log("moving ship /#" + gameplayState.choosedSth.id + "/ to (" + clickedTile.x + ", " + clickedTile.y + ")");

				gameplayState.choosedSth.moveTo(tiles.coords(clickedTile));
			}

			// jak kliknięto w wyspę to usuwamy zaznaczenie na jednostce
			if(clickedTile.islandId != INVALID_ID)
				gameplayState.choosedSth = undefined;
		}

		// usunięcie budynku
		if(gameplayState.removeMode && clickedTile.buildingData != null){
			clickedTile.buildingData.remove();

			wasAnyAction = true;
		}

		// zaznaczenie jednostki
		if(clickedTile.unitId != INVALID_ID)
			gameplayState.choosedSth = militaryUnits[clickedTile.unitId];
		// kliknięcie w budynek
		else if(clickedTile.buildingData != undefined)
			gameplayState.choosedSth = clickedTile.buildingData;
		// albo ostatecznie w nic nie kliknięto.
		else if(!(gameplayState.choosedSth instanceof Ship)) // <- TODO: to jest chujowe, tymczasowe rozwiązanie
			gameplayState.choosedSth = undefined;

		// TODO: Usunąć to gówno.
		// Przemyśleć jak, przydałby się na pewno jakiś "global controller" do tego typu
		// zmiennych jak gameplayState.choosedSth (może zmiana paradygmatu GUI?)
		if(!wasAnyAction)
			gameplayState.clickHandler(mouseX, mouseY);
	}

	// dodaje budynki na podstawie prostokąta do gameplayState.buildingsToPlacement
	function fillBuildingsToPlacement(){
		gameplayState.buildingsToPlacement = [];

		var fakeBegin = gameplayState.placementRectangle.begin;
		var fakeEnd = gameplayState.placementRectangle.end;

		if(fakeBegin == undefined || fakeEnd == undefined)
			return;

		var begin = _.clone(fakeBegin);
		var end = _.clone(fakeEnd);

		if(begin.x > end.x){
			begin.x = fakeEnd.x;
			end.x = fakeBegin.x;
		}

		if(begin.y > end.y){
			begin.y = fakeEnd.y;
			end.y = fakeBegin.y;
		}

		for(var i = begin.x; i <= end.x; i += gameplayState.testBuilding.width)
			for(var j = begin.y; j <= end.y; j += gameplayState.testBuilding.height)
				if(canBeBuild(i, j, gameplayState.testBuilding))
					gameplayState.buildingsToPlacement.push(tiles.coords(i, j));
	}

	function endBuildingMode(){
		gameplayState.placementRectangle.begin = tiles.coords(-1, -1);
		gameplayState.placementRectangle.end = tiles.coords(-1, -1);

		gameplayState.buildingsToPlacement = [];

		gameplayState.buildMode = false;
		gameplayState.useWidePlacement = false;
	}

	return new framework(new function(){
		this.resources = [ "atlas" ];

		this.fullscreen = true;

		this.onKeyDown = function(key){};
		this.onKeyUp = function(key){
			switch(key){
				case KEY_ARROW_UP:
						gameplayState.cameraPosition.y += KEYBOARD_MOVE_MAP_DIFF;
					break;

				case KEY_ARROW_DOWN:
						gameplayState.cameraPosition.y -= KEYBOARD_MOVE_MAP_DIFF;
					break;

				case KEY_ARROW_LEFT:
						gameplayState.cameraPosition.x += KEYBOARD_MOVE_MAP_DIFF;
					break;

				case KEY_ARROW_RIGHT:
						gameplayState.cameraPosition.x -= KEYBOARD_MOVE_MAP_DIFF;
					break;

				default:
					endBuildingMode();
					break;
			}
		};

		this.onMouseEnter = function(){};

		this.onMouseLeave = function(){
			gameplayState.hoveredTile = undefined;

			// gameplayState.placementRectangle.end = tiles.coords(-1, -1);

			if(!gameplayState.buildMode)
				gameplayState.moveMap = false;
			else {
				gameplayState.buildingsToPlacement = [];

				gameplayState.placementRectangle.begin = tiles.coords(-1, -1);
				gameplayState.placementRectangle.end = tiles.coords(-1, -1);
				
				gameplayState.useWidePlacement = false;
			}
		};

		var oldX = undefined;
		var oldY = undefined;

		this.onMouseMove = function(x, y){
			// pobieranie hover nad danym tilesem
			gameplayState.hoveredTile = picker.byGeometry(x, y);

			// poruszanie kamerą
			oldX = oldX || x;
			oldY = oldY || y;

			if(gameplayState.moveMap && !gameplayState.buildMode){
				gameplayState.cameraPosition.x += (x - oldX);
				gameplayState.cameraPosition.y += (y - oldY);
			}

			oldX = x;
			oldY = y;

			// ~~~

			// to jest tutaj tylko po to by można było wyświetlić podświetlenie
			// informację dla gracza jakie budynki się gdzie wybudują
			if(gameplayState.buildMode && gameplayState.testBuilding != undefined /*&& gameplayState.moveMap*/){
				gameplayState.placementRectangle.end = picker.byGeometry(x, y);

				if(!gameplayState.useWidePlacement)
					gameplayState.placementRectangle.begin = gameplayState.placementRectangle.end;

				fillBuildingsToPlacement();
			}
		};

		this.onMouseDown = function(x, y){
			gameplayState.moveMap = true;

			if(gameplayState.buildMode){
				gameplayState.placementRectangle.begin = picker.byGeometry(x, y);
				gameplayState.useWidePlacement = true;
			}
		};

		this.onMouseUp = function(x, y){
			gameplayState.moveMap = false;

			// kolejność zawsze jest taka: zdarzenie -> onMouseUp -> onMouseClick
			// ustawienie tutaj tej zmiennej (i ew. poinformowanie że wybudowano coś)
			// usuwa buga powowdującego automatyczne klikniecie w nowo wybudowany budynek
			wasAnyAction = false;

			if(gameplayState.buildMode){
				// uaktualnij placementRectangle
				gameplayState.placementRectangle.end = picker.byGeometry(x, y);
				fillBuildingsToPlacement();

				// wybuduj budynki z gameplayState.buildingsToPlacement
				for(var i = 0; i < gameplayState.buildingsToPlacement.length; i++){
					var buildingCoords = gameplayState.buildingsToPlacement[i];

					var structure = structsClass[gameplayState.testBuilding.__structId];
					new structure.class(buildingCoords.x,
										buildingCoords.y,
										countries[0],
										undefined,
										gameplayState.testBuilding.rotation);
				}

				// usuń zaznaczenie:

				gameplayState.buildingsToPlacement = [];

				gameplayState.placementRectangle.begin = tiles.coords(-1, -1);
				gameplayState.placementRectangle.end = tiles.coords(-1, -1);
				
				gameplayState.useWidePlacement = false;

				wasAnyAction = true;
			}
		};

		this.onMouseClick = function(x, y){
			clickedTile = picker.byColor(x, y);

			if(clickedTile != undefined){
				console.log("clicked tile (" + clickedTile.x + ", " + clickedTile.y + ")");
				
				makeClick(clickedTile, gameplayState.hoveredTile, x, y);
			} else
				console.log("out of board click");
		};

		this.onRender = function(delta, ctx, resources){
			draw(delta, ctx, gameplayState.cameraPosition, function(layerName){ return layerManager.getLayer(layerName); }, false);
		};
		
		this.onUpdate = function(delta){
			Logic.update(delta);
		};

		this.onLoadResources = function(resources){
			layerManager.setBaseLayer(resources['atlas']);

			layerManager.createLayer("lighter_1", function(context, baseLayer){
				context.globalCompositeOperation = "lighter";
				context.globalAlpha = 0.1;
				context.drawImage(baseLayer, 0, 0);
			});

			layerManager.createLayer("lighter_3", function(context, baseLayer){
				context.globalCompositeOperation = "lighter";
				context.globalAlpha = 0.33;
				context.drawImage(baseLayer, 0, 0);
			});

			layerManager.createLayer("lighter_5", function(context, baseLayer){
				context.globalCompositeOperation = "lighter";
				context.globalAlpha = 0.5;
				context.drawImage(baseLayer, 0, 0);
			});

			layerManager.createLayer("darkner", function(context, baseLayer){
				context.globalCompositeOperation = "multiply";
				context.drawImage(baseLayer, 0, 0);
			});

			layerManager.createLayer("oranger_tmp", function(context, baseLayer){
				context.globalCompositeOperation = 'source-in';
				context.fillStyle = "#CB9A50"; // http://paletton.com/#uid=7050I0kmRmRfLtbjtpupujttbfL
				context.globalAlpha = 0.33;
				context.fillRect(0, 0, context.canvas.width, context.canvas.height);
			});

			layerManager.createLayer("oranger", function(context, baseLayer){
				context.drawImage(layerManager.getLayer("oranger_tmp"), 0, 0);
			});

			// ~~~

			picker.initColorpicking(resources);
		};
	});
});