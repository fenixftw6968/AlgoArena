const fs = require('fs');
const path = require('path');
const { writeModule } = require('./questionWriter.js');

const { osQuestions } = require('./osQuestionsData.js');
const { dbmsQuestions } = require('./dbmsQuestionsData.js');
const { cnQuestions } = require('./cnQuestionsData.js');
const { oopQuestions } = require('./oopQuestionsData.js');

console.log('Writing frontend JS files...');

// Frontend data paths
const frontendDataDir = path.join(__dirname, '../frontend/src/data');
writeModule(path.join(frontendDataDir, 'osQuestions.js'), 'osQuestions', osQuestions);
writeModule(path.join(frontendDataDir, 'dbmsQuestions.js'), 'dbmsQuestions', dbmsQuestions);
writeModule(path.join(frontendDataDir, 'cnQuestions.js'), 'cnQuestions', cnQuestions);
writeModule(path.join(frontendDataDir, 'oopQuestions.js'), 'oopQuestions', oopQuestions);

// Backend JSON resources paths
const backendQuestionsDir = path.join(__dirname, '../backend/src/main/resources/questions');
fs.writeFileSync(path.join(backendQuestionsDir, 'os-quiz.json'), JSON.stringify(osQuestions, null, 2), 'utf8');
fs.writeFileSync(path.join(backendQuestionsDir, 'dbms-quiz.json'), JSON.stringify(dbmsQuestions, null, 2), 'utf8');
fs.writeFileSync(path.join(backendQuestionsDir, 'cn-quiz.json'), JSON.stringify(cnQuestions, null, 2), 'utf8');
fs.writeFileSync(path.join(backendQuestionsDir, 'oop-quiz.json'), JSON.stringify(oopQuestions, null, 2), 'utf8');

console.log('Successfully generated frontend and backend question files for OS, DBMS, CN, and OOP!');

