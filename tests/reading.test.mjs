import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBaidu, isCurrentAffairs } from '../scripts/baidu.mjs';
import { LESSONS, lessonForDate } from '../scripts/english-lessons.mjs';
import { dateKey, normalize, selectItems } from '../scripts/news-core.mjs';
const now = Date.parse('2026-09-20T12:00:00+08:00');
test('Baidu selects current affairs, rejects entertainment, labels observation time and retains distinct search URLs', () => {
  const rows = [
    {word:'地铁新增无障碍通道',desc:'交通出行服务优化。',url:'https://www.baidu.com/s?wd=transport&sa=feed',hotScore:'9000'},
    {word:'公积金政策发布',desc:'住房公积金新规解读。',url:'https://www.baidu.com/s?wd=housing&sa=feed',hotScore:'8000'},
    {word:'明星演唱会节目单',desc:'娱乐消息',url:'https://www.baidu.com/s?wd=music'},
    {word:'医院消息',desc:'医疗消息',url:'javascript:alert(1)'},
    {word:'就业政策',desc:'教育信息',url:'https://evil.example/s?wd=jobs'},
  ];
  const html = '<!--s-data:'+JSON.stringify({data:{cards:[{component:'hotList',content:rows}]}})+'-->';
  const parsed = parseBaidu(html,new Date(now).toISOString());
  assert.equal(parsed.length,2); assert.ok(parsed.every(x=>x.timeLabel==='热搜采集' && x.linkLabel==='查看相关新闻'));
  assert.ok(parsed.every(x=>!('hotScore' in x)));
  const selected = selectItems(parsed.map(x=>normalize(x,'baidu',now)),now);
  assert.equal(selected.length,2); assert.deepEqual(selected.map(x=>x.number),[1,2]);
  assert.equal(normalize(parsed[0],'baidu',now+25*3600000),null);
  assert.equal(isCurrentAffairs('球队夺冠','体育赛事'),false);
  assert.throws(()=>parseBaidu('<html>unavailable</html>'));
});
test('30 complete bilingual travel dialogues have glossary notes and distinct scenes', () => {
  assert.equal(LESSONS.length,30); assert.equal(new Set(LESSONS.map(x=>x.title)).size,30);
  for(const lesson of LESSONS){
    assert.equal(lesson.lines.length,6); assert.ok(lesson.words.length>=3);
    for(const [en,zh] of lesson.lines){assert.match(en,/[A-Za-z]/);assert.match(zh,/[\u4e00-\u9fff]/);}
    for(const [word,meaning,note] of lesson.words){assert.ok(word);assert.ok(meaning);assert.ok(note);}
    assert.equal(lesson.pattern.length,2);
  }
});
test('daily course changes at Beijing midnight, is stable within a day and cycles after 30 days', () => {
  const today=dateKey(new Date('2026-09-20T15:59:59Z')),tomorrow=dateKey(new Date('2026-09-20T16:00:00Z'));
  assert.equal(lessonForDate(today).number,1);assert.equal(lessonForDate(tomorrow).number,2);
  assert.equal(lessonForDate('2026-10-20').number,1);
  assert.equal(lessonForDate(today,-1).number,30);
  assert.deepEqual(lessonForDate(today),lessonForDate(today));
  assert.throws(()=>lessonForDate('2026-02-30'));
});
