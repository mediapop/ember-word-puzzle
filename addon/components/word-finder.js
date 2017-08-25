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

      const startX = Math.floor(Math.random() * 1000) % (this.get('gameWidth') - wordLength);
      const startY = Math.floor(Math.random() * 1000) % this.get('gameHeight');

      let restart = false;
      for (let column = startX; column < (startX + wordLength); column++) {
        if (this.get(`gameBoard.${startY}.${column}`)) {
          restart = true;
          break;
        }
      }
      if (restart) {
        continue
      }
      for (let column = startX; column < (startX + wordLength); column++) {
        this.addGamePiece(startY, column, placeWord[column - startX].toLowerCase());
      }

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
    const stateOffset = gamePiece.get('active') ? size : 0;

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
    const column = Math.floor(e.offsetX / this.get('gamePieceSize'));
    const row = Math.floor(e.offsetY / this.get('gamePieceSize'));
    const first = this.get('first');
    const target = this.get(`gameBoard.${row}.${column}`);

    if (!first) {
      this.set('first', target);
      this.set(`gameBoard.${row}.${column}.active`, true);
      return;
    }

    if (first.get('row') !== row && first.get('column') !== column) {
      return;
    }

    if (first === target) {
      this.set('first', undefined);
      this.set(`gameBoard.${row}.${column}.active`, false);
      return;
    }

    if (target.get('disabled')) {
      return;
    }

    let startingRow = first.get('row') < row ? first.get('row') : row;
    let endingRow = first.get('row') >= row ? first.get('row') : row;
    let startingColumn = first.get('column') < column ? first.get('column') : column;
    let endingColumn = first.get('column') >= column ? first.get('column') : column;

    for (let r = startingRow; r <= endingRow; ++r) {
      for (let c = startingColumn; c <= endingColumn; ++c) {
        this.set(`gameBoard.${r}.${c}.active`, true);
      }
    }

    if (this.get('isSelectionAWord')) {
      this.sendAction('clearedWord', this.get('selectionWord'));
      this.get('selection').forEach(selection => {
        selection.set('opacity', 0);
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
