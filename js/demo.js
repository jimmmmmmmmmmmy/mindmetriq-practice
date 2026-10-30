// Independently written guide and presentation metadata from the public demos.
// Reference captures and vendor source are private local files, never runtime assets.
const MMQDemo = (() => {
  const pages = {
    net: [
      ['Find the largest total','Slide the highlighted net over the grid. Only numbers covered by the net contribute to its total.','net'],
      ['Compare every position','A good total can still be wrong. Find the single placement with the greatest possible sum.','net'],
      ['Include negative tiles','Subtract every negative number in the net. Sometimes a negative tile is part of the best placement.','net'],
      ['Move without rotating','Drag the grid, or use the arrow keys. The net keeps its shape and size. Press Enter or Submit when ready.','keys'],
      ['Try the practice round','The timer starts with each fresh puzzle. The current position is submitted when time runs out.','duration']
    ],
    racer: [
      ['Reach the target','Choose falling numbers whose total is exactly the target. Leave the other numbers alone.','racer'],
      ['Every catch counts','Positive catches increase your total; negative catches reduce it. The round finishes after the final number.','racer'],
      ['More than one solution','Different subsets can reach the same target. Any exact total counts as correct.','racer'],
      ['Plan, then steer','Use five seconds to plan. Hold left or right to catch or avoid blocks; the queue falls from the bottom upward.','keys'],
      ['Try the practice round','Each round includes planning and eight falling numbers. Hard drill shortens both phases by 25%.','duration']
    ],
    swipe: [
      ['Compare meanings','Choose whether the words mean almost the same, almost the opposite, or have another relationship.','swipe'],
      ['Similar meanings','A synonym pair belongs on the right. Look for meaning, rather than matching spelling or sound.','swipe'],
      ['Opposite meanings','An antonym pair belongs on the left. The words should express opposing meanings.','swipe'],
      ['Other relationships','Related objects and words that only sound alike can still belong in Other. Swipe downward for this choice.','swipe'],
      ['Swipe or use the arrows','Drag the card far enough in your chosen direction, tap an arrow, or use the keyboard arrows.','keys'],
      ['Try four practice pairs','Each pair has its own six-second timer. Full timed tests still contain fifteen pairs.','duration']
    ],
    wordlogic: [
      ['Complete the comparison','Find the answer that follows the relationship shown by the first pair of words.','wordlogic'],
      ['Name the relationship','Decide what links the first word to the second: for example, a young animal and its adult form.','wordlogic'],
      ['Keep the direction','Apply that same relationship to the third word, then choose the matching answer.','wordlogic'],
      ['Use time boosts carefully','Three boosts each add ten seconds. A boost becomes available when thirteen seconds or less remain. Space also activates a boost.','keys'],
      ['Try the practice round','Use the arrow keys to highlight an answer and Enter to submit, or tap an option. Boosts are shared across the run.','duration']
    ],
    pipes: [
      ['Connect the fixed ends','Swap the blue pipes to make a continuous route between the two dark end tiles.','pipes'],
      ['Only pipes move','The grey obstacles and dark ends stay fixed. Pipes cannot rotate; each opening needs a matching neighbour.','pipes'],
      ['Select two blue tiles','Tap two pipes to exchange them, or drag one onto the other. Arrow keys move the cursor; Enter selects.','keys'],
      ['Try the practice round','A connected route is accepted automatically. There is no Submit button.','duration']
    ],
    spinner: [
      ['Align the wheel','Rotate the inner symbols until every inner and outer pair shares exactly one feature.','spinner'],
      ['Reject both or neither','A pair fails when shape and shading both match. It also fails when neither matches.','spinner'],
      ['Accept exactly one match','Same shape with different shading works. Same shading with different shapes also works.','spinner'],
      ['Rotate and submit','Drag the wheel, use the left and right buttons, or press the arrow keys. Check all pairs before pressing Enter.','keys'],
      ['Try the practice round','You have twelve seconds per wheel. The current position is submitted when the timer ends.','duration']
    ]
  };
  function example(id, page) {
    if(id==='net'){const s=MMQLogic.net.newItem(1);return MMQReview.render(id,{...s,pos:s.bp});}
    if(id==='racer'){const s=MMQLogic.racer.newItem(1);return `<p class="tutorial-target">Target: ${s.target}</p>`+MMQReview.render(id,{...s,got:s.sol});}
    if(id==='swipe'){const pairs=[['begin','start','S'],['begin','start','S'],['arrive','depart','A'],['lock','key','N']];const p=pairs[Math.min(page,3)];return MMQReview.render(id,{words:p.slice(0,2),answer:p[2],picked:null});}
    if(id==='wordlogic'){return MMQReview.render(id,{b:[1,'lamb','sheep','kitten','cat'],opts:['dog','cat','horse','duck','pig'],selected:-1,relation:'young animal → adult'});}
    if(id==='pipes')return MMQReview.render(id,MMQLogic.pipes.newItem(1));
    const s=MMQLogic.spinner.newItem(1);return MMQReview.render(id,{...s,rot:0},page===1?'submitted':'solution');
  }
  function art(id) {
    const paths={net:'M20 50h50V20h50v50h50v50h-50v50H70v-50H20z',racer:'M90 15l55 145-55-35-55 35z M25 35h25v25H25z M140 80h25v25h-25z',swipe:'M40 30h100v125H40z M55 90h70 M15 75l-12 15 12 15 M165 75l12 15-12 15',wordlogic:'M20 140l35-100 35 100 M33 105h45 M110 45h45 M132 45v95',pipes:'M25 30h60v60h65v60H90v-40H25z',spinner:'M90 15a75 75 0 1 0 1 0 M90 45v35 M130 120l-30-18 M50 120l30-18'};
    return `<svg class="intro-art" viewBox="0 0 180 180" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="${paths[id]}"/></svg>`;
  }
  return { pages, example, art };
})();
