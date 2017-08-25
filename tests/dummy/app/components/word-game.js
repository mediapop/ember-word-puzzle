import Ember from 'ember';

export default Ember.Component.extend({
  points: 0,
  words: ['VIENTIANE', 'MANDALAY', 'HANOI', 'CHENGDU', 'LOMBOK', 'DARWIN'],
  clearedWords: Ember.A(),
  gameStatus: Ember.computed('words.[]', 'clearedWords.[]', function () {
    const clearedWords = this.get('clearedWords');
    return this.get('words').map(word => {
      return {word: word, active: !clearedWords.includes(word)}
    })
  }),
  actions: {
    clearedWord: function (word) {
      this.get('clearedWords').addObject(word.toUpperCase());
      this.set('points', this.get('points') + 10);
    }
  }
})
