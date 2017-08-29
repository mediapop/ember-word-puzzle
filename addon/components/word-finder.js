import Ember from 'ember';

const GamePiece = Ember.Object.extend({
  x1: Ember.computed('row', 'column', 'size', function () {
    const column = this.get('column');
    const width = this.get('size');
    return column * width;
  }),
  y1: Ember.computed('row', 'column', 'size', function () {
    const row = this.get('row');
    const height = this.get('size');
    return height * row;
  }),
  type: Ember.computed('letter', function () {
    return this.get('letter').charCodeAt() - 97;
  }),
  active: false,
  opacity: 1,
  disabled: false
});

export default Ember.Component.extend({
  tagName: 'canvas',
  gameWidth: 10,
  gameHeight: 10,
  gamePieceSize: 50,
  paused: false,
  width: Ember.computed('gamePieceSize', 'gameWidth', function () {
    return this.get('gameWidth') * this.get('gamePieceSize');
  }),
  height: Ember.computed('gamePieceSize', 'gameHeight', function () {
    return this.get('gameHeight') * this.get('gamePieceSize');
  }),
  _start: 0,
  attributeBindings: ['width', 'height'],
  gameBoard: [],
  initializeAGameBoard() {
    const gameWidth = this.get('gameWidth');
    const gameHeight = this.get('gameHeight');
    this.set('remaining', this.get('words.length'));

    

    const board = [];

    for (let row = 0; row < gameHeight; row++) {
      const rowPieces = [];
      for (let column = 0; column < gameWidth; column++) {
        rowPieces.push(undefined);
      }
      board.push(rowPieces)
    }

    let placements = Array.from(this.get('words'));

    this.set('gameBoard', board);

    while (placements.length) {
      const placeWord = placements[0];
      const wordLength = placeWord.length;
      let directionX;
      let directionY;

      switch (Math.floor(Math.random() * 1000) % 3) {
        case 0:
          directionX = 1;
          directionY = 0;
          break;
        case 1:
          directionX = 0;
          directionY = 1;
          break;
        case 2:
          directionX = 1;
          directionY = 1;
          break;
      }

      const placementRangeX = this.get('gameWidth') - (directionX ? wordLength : 1) + 1;
      const placementRangeY = this.get('gameHeight') - (directionY ? wordLength : 1) + 1;

      const startX = Math.floor(Math.random() * 1000) % placementRangeX;
      const startY = Math.floor(Math.random() * 1000) % placementRangeY;
      const coordinates = [];

      let restart = false;
      for (let character = 0; character < wordLength; character++) {
        const row = startY + character * directionY;
        const column = startX + character * directionX;

        if (this.get(`gameBoard.${row}.${column}`)) {
          restart = true;
          break;
        }

        coordinates.push({row, column, character});
      }

      if (restart) {
        continue
      }

      coordinates.forEach(
        coordinate => this.addGamePiece(
          coordinate.row,
          coordinate.column,
          placeWord[coordinate.character].toLowerCase()
        )
      );

      placements.shift();
    }

    for (let row = 0; row < gameHeight; row++) {
      for (let column = 0; column < gameWidth; column++) {
        if (!this.get('gameBoard')[row][column]) {
          this.addGamePiece(row, column);
        }
      }
    }
  },

  resourceLoaded() {
    if (this.decrementProperty("_start") === 0) {
      this.startGame();
    }
  },

  loadResource(path, name) {
    const image = new Image();
    image.onload = this.resourceLoaded.bind(this);
    image.src = path;
    this.set(name, image);
    this.incrementProperty("_start");
  },

  startGame() {
    this.initializeAGameBoard();
    this.set('lastTime', new Date());
    this.gameLoop();
  },

  drawGameBoard() {
    const gameBoard = this.get("gameBoard");
    gameBoard.forEach(row => row.forEach(this.drawGamePiece.bind(this)));
  },
  drawGamePiece(gamePiece) {
    const ctx = this.get('ctx');
    const letters = this.get('letters');
    const type = gamePiece.get('type');
    const size = this.get('gamePieceSize');

    let stateOffset = 0;
    if (gamePiece.get('active')) {
      stateOffset = size;
    } else if (gamePiece.get('disabled')) {
      stateOffset = size * 2;
    }

    ctx.save();
    ctx.globalAlpha = gamePiece.get('opacity');

    ctx.drawImage(
      letters,
      type * size,
      stateOffset,
      size,
      size,
      gamePiece.get('x1'),
      gamePiece.get('y1'),
      size,
      size);

    ctx.restore();
  },
  clearBoard() {
    const ctx = this.get('ctx');
    ctx.clearRect(0, 0, this.get('width'), this.get('height'));
  },

  willDestroyElement() {
    cancelAnimationFrame(this.get('runLoop'));
  },

  gameLoop() {
    this.set('runLoop', requestAnimationFrame(this.gameLoop.bind(this)));

    const dateNow = new Date();
    this.set("duration", dateNow - this.get('lastTime'));
    this.set('lastTime', dateNow);

    if (this.get('paused')) {
      return;
    }

    this.clearBoard();
    this.drawGameBoard();
  },

  getRandomLetter() {
    return String.fromCharCode(Math.floor(Math.random() * 100000 % 26) + 97);
  },

  addGamePiece(row, column, letter = this.getRandomLetter()) {
    this.get('gameBoard')[row][column] = GamePiece.create({
      row,
      column,
      letter,
      size: this.get('gamePieceSize')
    });
  },

  didInsertElement() {
    const ctx = this.element.getContext("2d");
    this.set("ctx", ctx);

    this.loadResource("/letters.png", "letters");
  },

  click(e) {
    const coordinateRatio = this.element.width / this.element.clientWidth;
    const column = Math.floor(e.offsetX * coordinateRatio / this.get('gamePieceSize'));
    const row = Math.floor(e.offsetY * coordinateRatio / this.get('gamePieceSize'));


    const first = this.get('first');
    const target = this.get(`gameBoard.${row}.${column}`);

    if (target.get('disabled')) {
      return;
    }

    if (!first) {
      this.set('first', target);
      this.set(`gameBoard.${row}.${column}.active`, true);
      return;
    }

    const distanceX = Math.abs(first.get('column') - target.get('column'));
    const distanceY = Math.abs(first.get('row') - target.get('row'));
    const isDiagonal = distanceX === distanceY;

    if (first.get('row') !== row && first.get('column') !== column && !isDiagonal) {
      return;
    }


    if (first === target) {
      this.set('first', undefined);
      this.set(`gameBoard.${row}.${column}.active`, false);
      return;
    }

    let startingRow = first.get('row') < row ? first.get('row') : row;
    let endingRow = first.get('row') >= row ? first.get('row') : row;
    let startingColumn = first.get('column') < column ? first.get('column') : column;
    let endingColumn = first.get('column') >= column ? first.get('column') : column;

    const distance = distanceX > distanceY ? distanceX : distanceY;

    for (let i = 0; i <= distance; i++) {
      const row = startingRow + (startingRow !== endingRow ? i : 0);
      const column = startingColumn + (startingColumn !== endingColumn ? i : 0);
      this.set(`gameBoard.${row}.${column}.active`, true);
    }

    if (this.get('isSelectionAWord')) {
      this.clearWord();
      this.get('selection').forEach(selection => {
        selection.set('disabled', true);
        selection.set('active', false);
      });
    } else {
      this.get('selection').forEach(selection => {
        selection.set('active', false);
      });
    }
    this.set('first', undefined);
  },

  clearWord() {
    this.sendAction('clearedWord', this.get('selectionWord'));
    const remaining = this.decrementProperty('remaining');
    if (remaining === 0) {
      this.sendAction('gameOver');
    }
  },

  isSelectionAWord: Ember.computed("selectionWord", function () {
    return this.get('words').map(word => word.toLowerCase()).includes(this.get("selectionWord"));
  }).volatile(),
  selectionWord: Ember.computed('selectionLetters', function () {
    return this.get('selectionLetters').join("");
  }).volatile(),
  selectionLetters: Ember.computed.mapBy('selection', 'letter').volatile(),

  // @todo It should be possible to do gameBoard.@each.@each.active, or some variant.
  selection: Ember.computed(function () {
    let gamePieces = [];

    this.get('gameBoard').forEach(row => row.forEach(gamePiece => {
      if (gamePiece.get('active')) {
        gamePieces.push(gamePiece);
      }
    }));

    gamePieces = gamePieces.sort((a, b) => {
      return a.get('row') >= b.get('row') && a.get('column') >= b.get('column');
    });

    return gamePieces;
  }).volatile()
});
