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
  remaining: Ember.computed.reads('words.length'),
  gameBoardFactory: function () {
    const gameWidth = this.get('gameWidth');
    const gameHeight = this.get('gameHeight');

    const board = [];

    for (let row = 0; row < gameHeight; row++) {
      const rowPieces = [];
      for (let column = 0; column < gameWidth; column++) {
        rowPieces.push(undefined);
      }
      board.push(rowPieces)
    }

    return board;
  },
  initializeAGameBoard() {
    const gameWidth = this.get('gameWidth');
    const gameHeight = this.get('gameHeight');

    this.set('gameBoard', this.gameBoardFactory());

    let placements = Array.from(this.get('words'));

    const MAX_RETRY_LIMIT = 100;

    let retryPlacementLimit = MAX_RETRY_LIMIT;

    while (placements.length) {
      retryPlacementLimit--;

      if (retryPlacementLimit <= 0) {
        retryPlacementLimit = MAX_RETRY_LIMIT;
        placements = Array.from(this.get('words'));
        this.set('gameBoard', this.gameBoardFactory());
      }

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
        if (!this.get(`gameBoard.${row}.${column}`)) {
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

  mouseDown(e) {
    this.set('mousePressed', {
      offsetX: e.offsetX,
      offsetY: e.offsetY
    });
  },

  mouseMove(e) {
    e.preventDefault();
    const mousePressed = this.get('mousePressed');
    if (mousePressed && !this.get('mouseSelection')) {
      const distance = Math.abs(e.offsetX - mousePressed.offsetX) + Math.abs(e.offsetY - mousePressed.offsetY);
      this.set('mouseSelection', distance > 10);
    }
    if (this.get('mouseSelection')) {
      const origin = this.toGameGrid(mousePressed.offsetX, mousePressed.offsetY);
      const target = this.toGameGrid(e.offsetX, e.offsetY);
      this.setActive(origin.row, origin.column, target.row, target.column);
    }
  },

  mouseUp() {
    this.set('mousePressed', false);
  },

  touchStart(e) {
    const {x, y} = this.touchCoordinates(e);
    const {row, column} = this.toGameGrid(x, y);

    this.set("selectionStart", {
      row,
      column
    });
  },

  touchMove(e) {
    e.preventDefault();
    const origin = this.get('selectionStart');
    const {x, y} = this.touchCoordinates(e);
    const target = this.toGameGrid(x, y);
    this.setActive(origin.row, origin.column, target.row, target.column);
    this.set("touchSelection", true);
  },

  touchEnd() {
    if (this.get('touchSelection')) {
      this.doSelectionMatching();
      this.set('touchSelection', false);
    }
  },

  touchCoordinates(e) {
    const rect = this.element.getBoundingClientRect();
    const x = e.pageX - rect.left;
    const y = e.pageY - rect.top;
    return {
      x, y
    };
  },

  toGameGrid(x, y) {
    const coordinateRatio = this.element.width / this.element.clientWidth;
    const column = Math.floor(x * coordinateRatio / this.get('gamePieceSize'));
    const row = Math.floor(y * coordinateRatio / this.get('gamePieceSize'));
    return {
      row, column
    };
  },

  setActive(fromX, fromY, toX, toY) {
    // If the selection isn't forwards diagonal, horizontal or vertical the selection will stay on the first.
    if (fromX > toX || fromY > toY) {
      toX = fromX;
      toY = fromY;
    }

    const distanceX = Math.abs(fromX - toX);
    const distanceY = Math.abs(fromY - toY);
    const distance = (distanceX > distanceY ? distanceX : distanceY) + 1;

    this.get('selection').forEach(gamePiece => gamePiece.set('active', false));

    if (distanceX === distanceY || distanceX === 0 || distanceY === 0) {
      const directionX = distanceX > 0 ? 1 : 0;
      const directionY = distanceY > 0 ? 1 : 0;
      for (let i = 0; i < distance; ++i) {
        const row = fromX + i * directionX;
        const column = fromY + i * directionY;
        this.set(`gameBoard.${row}.${column}.active`, true);
      }
    }
  },

  click(e) {
    if (this.get('mouseSelection')) {
      return this.doSelectionMatching();
    }
    const {row, column} = this.toGameGrid(e.offsetX, e.offsetY);

    const first = this.get('first');
    const target = this.get(`gameBoard.${row}.${column}`);

    if (target.get('disabled')) {
      return;
    }

    if (!first) {
      this.set('first', target);
      return this.setActive(row, column, row, column);
    }

    this.setActive(first.get('row'), first.get('column'), row, column);
    this.doSelectionMatching();
  },

  doSelectionMatching() {
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
    this.set('selectionStart', undefined);
    this.set('touchSelection', undefined);
    this.set('mouseSelection', undefined);
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
