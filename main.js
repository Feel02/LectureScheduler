const fs = require('fs');
const readline = require('readline');
const prompt = require('prompt-sync')({ sigint: true });
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];                                              //Days
const startHour = 0;                                                                                                // 9.00 AM
const endHour = 540;                                                                                                // 6.00 PM ((18-9) * 60)

const coursesFilePath = 'Fall_Courses.csv';
const roomsFilePath = 'Classroom_Capacities.csv';
const busyLecturerConstrainsFilePath = 'constrains.csv';
const specifiedLectureConstrainsFilePath = 'constrains2.csv';
const mandatoryLecturesFilePath = 'mandatory.csv';
var courses = [];                                                                                                   //They are our global input arrays 
var rooms = [];
var busyLecturerConstrains = [];
var specifiedLectureConstrains = [];
var mandatoryLectures = [];

(async () => {                                                                                                      //########   MAIN FUNCTION   ########
                                                                                                                    //Create a day 0 trial
    var initialSchedule = await assignCoursesToRooms();              

    initialSchedule = await hillClimbing(initialSchedule, 30000);                                                   //20000-30000 for best results

    const optimizedSchedule =  await simulatedAnnealingScheduler(initialSchedule, 0.99994, 0.001);                  //0.99994 for best result (CHANGING ISN'T SUGGESTED)

    //const optimizedSchedule = await hillClimbSpecified(initialSchedule, 50000);

    /* let inx = 0;

    initialSchedule
    .sort(
        (a, b) => {
            let dayA = days.indexOf(a.day);
            let dayB = days.indexOf(b.day);

            if (dayA < dayB)
                return -1;

            if (dayA > dayB)
                return 1;

            return 0;
        }
    )
    .forEach(entry => {
        initialSchedule2[inx] = entry;
        inx++;
    }); */

    // await geneticAlgorithmScheduler(initialSchedule2, rooms, 10000,0.3);       

    var output = [];
    output.push('course_code,day,time,duration,classroom,grade,department,course_name,professor_name')

    optimizedSchedule
    .sort(
        (a, b) => {
            let timeA = a.startTime;
            let timeB = b.startTime;

            if (timeA < timeB)
                return -1;

            if (timeA > timeB)
                return 1;

            return 0;
        }
    )
    .sort(
        (a, b) => {
            let dayA = days.indexOf(a.day);
            let dayB = days.indexOf(b.day);

            if(dayA < dayB)
                return -1;

            if(dayA > dayB)
                return 1;

            return 0;
        }
    )
    .forEach(entry => {
        let course_code = entry.courseId;
        let classroom = entry.room;
        let day = days.indexOf(entry.day);
        let time = entry.startTime;
        let duration = entry.course.duration;
        let grade = entry.course.year;
        let department = entry.course.department;
        let course_name = entry.course.courseName;
        let professor_name = entry.course.professorName;

        output.push(course_code + ',' + day + ',' + time + ',' + duration + ',' + classroom + ',' + grade + ',' + department + ',' + course_name + ',' + professor_name);

    });

    console.log('The output is created.')

                                                                                                                    // Write schedule to csv file
    const outputData = output.join('\n');
    fs.writeFileSync('Lecture_Schedule.csv', outputData, 'utf-8');
    
    const open = (await import('open')).default;

    // Opens the URL in the default browser.
    await open('https://feel02.github.io/UiTrialsForLectureScheduler/home.html');
 
    // Opens the URL in a specified browser.
    // await open('https://sindresorhus.com', {app: 'firefox'});
 
    // Specify app arguments.
    // await open('https://sindresorhus.com', {app: ['google chrome', '--incognito']});

})();

async function readFileLines(filePath){                                                                             //########  Input csv function  ########
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });
    const lines = [];

    for await(const line of rl){
        lines.push(line);                                                                                           //get every line and push it
    }

    return lines.slice(1);                                                                                          //delete the first like which has no data
}

async function assignCoursesToRooms(){                                                                              //########  Create day 0 function  ########
    const coursesLines = await readFileLines(coursesFilePath);
    const roomsLines = await readFileLines(roomsFilePath);
    const busyLecturerConstrainLines = await readFileLines(busyLecturerConstrainsFilePath);
    const specifiedLectureLines = await readFileLines(specifiedLectureConstrainsFilePath);
    const mandatoryLines = await readFileLines(mandatoryLecturesFilePath);

    var tempRooms = roomsLines.map(line => ({ roomId: line.split(',')[0], roomSize: line.split(',')[1]}));
    for(const room of tempRooms){                                                                                   //get the rooms from the file and split them accordingly
        rooms.push(room);                                                                                           //this for ensures that we're saving rooms to the global variable
    }
    rooms.sort((a, b) => a.roomSize - b.roomSize);                                                                  //sort them based on their sizes

    let courseDetails = coursesLines.map(line => ({                                                                 //take the courses and rooms and create objects
        professorName: line.split(';')[9],
        courseId: line.split(';')[1],
        duration: parseInt((line.split(';')[5]).split('+')[0]) * 60 == 0 ? parseInt((line.split(';')[5]).split('+')[1]) * 60 : parseInt((line.split(';')[5]).split('+')[0]) * 60,
        numberOfStudents: parseInt((line.split(';')[3])),
        department: line.split(';')[8],             //10
        year: parseInt(line.split(';')[7]),
        facetoface: line.split(';')[4],
        courseName: line.split(';')[2]
    }));

    for(const coursesLinesTemp of coursesLines){
        let course = coursesLinesTemp.split(';');
        if(parseInt(course[5].split('+')[0]) !== 0 && parseInt(course[5].split('+')[1]) !== 0){
            courseDetails.push({professorName: course[9], courseId: course[1] + ' LAB', duration: parseInt(course[5].split('+')[1]) * 60, numberOfStudents: parseInt(course[3]), department: course[8], year: parseInt(course[7]), facetoface: 'lab', courseName: course[2] + ' LAB'});
        }
    }

    for(const course of courseDetails){                                                                             //get the courses 
        courses.push(course);                                                                                       //this is for ensuring that we're saving courses to the global variable
    }
    courses.sort((a,b) => a.duration - b.duration);                                                                 //sort them based on their durations

    let constrainTemp = busyLecturerConstrainLines.map(line => ({ lecturerName: line.split(',')[0], day: line.split(',')[1]}));
    for(const constrain of constrainTemp){                                                                          //get the busy lecturers from the file and split them accordingly
        busyLecturerConstrains.push(constrain);                                                                     //this for ensures that we're saving busy lecturers to the global variable
    }

    let constrainTemp2 = specifiedLectureLines.map(line => ({ lectureName: line.split(',')[0], day: line.split(',')[1], time: parseInt(line.split(',')[2])}));
    for(const constrain of constrainTemp2){                                                                          //get the rooms specified lectures the file and split them accordingly
        specifiedLectureConstrains.push(constrain);                                                                  //this for ensures that we're saving specified lectures to the global variable
    }

    let mandatoryTemp = mandatoryLines.map(line => ({ lectureName: line.split(',')[0]}));
    for(const mandatory of mandatoryTemp){                                                                          //get the mandatory lectures from the file and split them accordingly
        mandatoryLectures.push(mandatory);                                                                          //this for ensures that we're saving mandatory lectures to the global variable
    }

    let schedule = [];                                                                                              //our schedule

    blockedDayIndex = -1;                                                                                           //we assume no blockday
                                                                                                                    //add a spesified lecture
    blockHour = prompt('Do you want to block a specific hour? (y/n): ').toLowerCase() === 'y';
    let blockedName,blockedProf,blockedDepartment,blockedMin,blockedNumber,blockedYear,blockFullName;
    if(blockHour){
        flagBlocked = 0;
        blockedName = prompt('Name of the lecture? (Example: TIT101): ');
        blockedProf = prompt('Name of the proffesor? (Example: Dr. Öğr. Üyesi FADİ YILMAZ): ');
        blockedDepartment = prompt('Name of the department? (Example: CENG): ');
        blockedMin = prompt('How many minutes will it take? (Example: 60): ');
        blockedNumber = prompt('How many students will take? (Example: 78): ');
        blockedYear = prompt('Which year students will take the lecture? (Example: 2): ');
        blockFullName = prompt('What is the full name of the lecture? : ');

        blockedNumber = parseInt(blockedNumber);
        blockedMin = parseInt(blockedMin);
        blockedYear = parseInt(blockedYear);

        try{                                                                                                        //create the lecture and push it
            courses.push({ professorName: blockedProf, courseId: blockedName, duration: blockedMin, numberOfStudents: blockedNumber, department: blockedDepartment, year: blockedYear,facetoface:'classroom', courseName:blockFullName});
        } catch(e){
            console.log('Invalid input. Blocking skipped.');
        }
    }

    for(const course of courses){                                                                                   //search through every course
        if(course.facetoface === 'online'){                                                                         //if they are online skip it
            continue;
        }
        else if(course.facetoface === 'lab'){                                                                       //if they are lab set their class as 'LAB'
            if(course.department === 'MATEMATİK' && course.courseId.slice(0, 4) === 'MATH'){
                let assigned = false;

                for(const room of rooms){                                                                               //check every class
                    if(assigned)
                        break;

                    if(parseInt(room.roomSize) < course.numberOfStudents)                                               //if the size is not enough skip the class
                        continue;

                    schedule.push({day: days[Math.floor(Math.random() * days.length)], startTime: startHour, finishTime:course.duration, courseId: course.courseId, room: room.roomId, course: course});
                    assigned = true;

                }
            }
            else{
                schedule.push({day: days[Math.floor(Math.random() * days.length)], startTime: startHour, finishTime:course.duration, courseId: course.courseId, room: 'LAB', course: course});
            }
        }
        else{                                                                                                       //if they are start course
            let assigned = false;

            for(const room of rooms){                                                                               //check every class
                if(assigned)
                    break;

                if(parseInt(room.roomSize) < course.numberOfStudents)                                               //if the size is not enough skip the class
                    continue;

                schedule.push({day: days[Math.floor(Math.random() * days.length)], startTime: startHour, finishTime:course.duration, courseId: course.courseId, room: room.roomId, course: course});
                assigned = true;

            }
        }
    }

    return schedule;                                                                                                //schedule
}

function errorCalculateFunction(schedule){                                                                          //########  Error calculation  ########
    let error = 0;

    let len = schedule.length;

    for(let i = 0; i < len; i++){                                                                                   //linear search
                                                                                                                    //note to myself: try sort first then calculate error
        const day1 = schedule[i].day;
        const start1 = schedule[i].startTime;
        const end1 = schedule[i].finishTime;
        const coursename1 = schedule[i].courseId;
        const duration1 = schedule[i].course.duration;
        const prof1 = schedule[i].course.professorName;
        const year1 = schedule[i].course.year;
        const dep1 = schedule[i].course.department;

        for(let a = 0; a < busyLecturerConstrains.length; a++){
            if(busyLecturerConstrains[a].lecturerName === prof1){
                if(busyLecturerConstrains[a].day === day1){
                    error -= 1000;
                }
            }
        }

        for(let a = 0; a < specifiedLectureConstrains.length; a++){
            if(specifiedLectureConstrains[a].lectureName === coursename1){
                if(specifiedLectureConstrains[a].day != day1 || specifiedLectureConstrains[a].time != start1){
                    error -= 1000;
                }
            }
        }


        for(let j = i + 1; j < len; j++){

            const day2 = schedule[j].day;

            if(day1 === day2){                                                                                      //if the day is equal

                const duration2 = schedule[j].course.duration;

                if(duration1 != 0 && duration2 != 0){                                                               //duration not zero
                    
                    const coursename2 = schedule[j].courseId;
                    const start2 = schedule[j].startTime;
                    const end2 = schedule[j].finishTime;
                    const prof2 = schedule[j].course.professorName;
                    const dep2 = schedule[j].course.department;
                    const year2 = schedule[j].course.year;

                    if((start1 <= end2 && end1 >= start2) && ((start1 == end2 ? end1 != start2+duration1+duration2: true) && (start2 == end1 ? end2 != start1+duration1+duration2: true))){
                                                                                                                //if they intersect
                        if(prof1 === prof2){                                                                    //and if their prof is same it's an error
                            error -= 50; //lecturer conflict 
                        }

                        if(dep1 === dep2){                                                                      //and if their department is same
                            if(year1 === year2){                                                                //and and their year is same it's an error
                                error -= 150; //year conflict 
                            }
                            else if(Math.abs(year1 - year2) == 1){                                              //and and their year is in a row it's an error
                                if(year1 == 4 || year2 == 4){
                                    if(mandatoryLectures.indexOf(coursename1) > 0 && mandatoryLectures.indexOf(coursename2) > 0){
                                        error -= 100;
                                    }   
                                    else{
                                        error -= 5;
                                    }
                                }
                                else{
                                    error -=10;
                                }
                            }
                        }

                        if(schedule[i].room === schedule[j].room && schedule[i].room !== 'LAB'){                //and if they use the same classroom it's an error
                            error -= 50; //class conflict 
                        }
                    }

                    else if((start1 == end2 || start2 == end1) && prof1 === prof2 && duration1+duration2 > 240){//if they do not intersect but same prof has a 2 lectures in a row it's an error
                        error -= 50;    
                    }

                    else if((start1 == end2 || start2 == end1) && dep1 === dep2 && year1 === year2 && duration1+duration2 > 120){//if they do not intersect but same year&dep has a 2 lectures in a row it's an error
                        error -= 30;    
                    }

                    else if((start1+60 == end2 || start2+60 == end1) &&  dep1 === dep2 && year1 === year2 && duration1+duration2 > 240){//if they do not intersect but same year&dep has a 2 lectures with just 1 hour gap it's an error
                        error -= 20;    
                    }
                }
            }
        }
    }
    return error;
}

async function hillClimbing(initialSchedule, maxIterations){                                                        //########  Hill climb algorithm  ########
    let currentSchedule = [...initialSchedule];                                                                     //save the initialSchedule
    let currentError = errorCalculateFunction(currentSchedule);                                                     //calculate the start error

    if(currentError == 0)
        return initialSchedule;                                                                                     //if you ever find a perfect solution finish it

    for(let iteration = 0; iteration < maxIterations; iteration++){                                                 //else randomly move one course to a new time slot
        
        let newSchedule = [...currentSchedule];
        const randomIndex = Math.floor(Math.random() * newSchedule.length);                                         //select course
    
        var day = newSchedule[randomIndex].day;
        var start = newSchedule[randomIndex].startTime;
        var end = newSchedule[randomIndex].finishTime;
        var coursename = newSchedule[randomIndex].courseId;
        var duration = newSchedule[randomIndex].course.duration;
        var room = newSchedule[randomIndex].room;
        const course = newSchedule[randomIndex].course;

        let newRoom = newSchedule[randomIndex].room;                                                                //hold the current class
        let newStartTime = start;                                                                                   //hold the start time
        let newDayIndex = days.findIndex(dayy => dayy === day);                                                     //hold the day

        let chance = Math.random();                                                                                 //random chance

        if(chance < 0.01){                                                                                          //if chance is less than 0.01, change the room
            if(newRoom != 'LAB'){
                let roomInx = rooms.findIndex(roomTemp => roomTemp.roomId === newRoom);
                try{
                    newRoom = rooms[Math.random() < 0.3 ? roomInx - 1: roomInx + 1].roomId;
                } catch(e){

                }
            }
        }
        else if(chance < 0.6){                                                                                      //else if chance is less 0.6, change the start time
            newStartTime = (Math.floor(Math.random() * (((endHour - startHour) / 60) - duration / 60)) * 60)
            if(start == newStartTime)
                newStartTime += 60
        }
        else{                                                                                                       //else if chance is less than 0.4 change the day
            newDayIndex = Math.floor(Math.random() * days.length); 
        }
                                                                                            
        newSchedule[randomIndex] = {day: days[newDayIndex], startTime: newStartTime, finishTime:newStartTime + duration, courseId: coursename, room: newRoom, course: course};
                                                                                                                    //add to the new schedule
        
        const newError = errorCalculateFunction(newSchedule);                                                       //calculate the error

        if(newError > currentError){                                                                                //if the error is better (it's negative so I used > sign)
            currentSchedule = newSchedule;                                                                          //save the new schedule
            currentError = newError;                                                                                //save the error
            console.log(currentError+ ' ' + '%'+(Math.round((100*iteration/maxIterations) * 100) / 100).toFixed(2) + ' -HC');
        }
        if(newError == 0){                                                                                          //if error is 0 then it's the perfect schedule
            console.log('Found with ' + currentError + ' error' + ' in ' + iteration + 'th iteration');
            return currentSchedule;
        }

    }

    return currentSchedule;

}

async function simulatedAnnealingScheduler(initialSchedule, cooling, finish){                                       //########  Simulated Anneling algorithm  ########
    let currentSchedule = [...initialSchedule];                                                                     //save the initialSchedule
    let currentError = errorCalculateFunction(currentSchedule);                                                     //calculate the start error

    let minimum;                                                                                                    //minimum schedule
    let minimumError = -9999999;                                                                                     //minimum error

    let temperature = 10;                                                                                           //start temperature
    let iteration = 0;                                                                                              //start iteration (for the console print)
  
    while(temperature > finish){                                                                                    //while temperature is bigger than the finish
        iteration++;
        let newSchedule = [...currentSchedule];                                                                     //create new schedule 
        const randomIndex = Math.floor(Math.random() * newSchedule.length);                                         //randomly pick a lecture
  
        var day = newSchedule[randomIndex].day;
        var start = newSchedule[randomIndex].startTime;
        var end = newSchedule[randomIndex].finishTime;
        var coursename = newSchedule[randomIndex].courseId;
        var duration = newSchedule[randomIndex].course.duration;
        var room = newSchedule[randomIndex].room;
        const course = newSchedule[randomIndex].course;
  
        let newRoom = newSchedule[randomIndex].room;                                                                //hold the room
        let newStartTime = start;                                                                                   //hold the start time
        let newDayIndex = days.findIndex(dayy => dayy === day);                                                     //hold the day
  
        let chance = Math.random();                                                                                 //random chance
  
        if(chance < 0.1){                                                                                           //if chance is less than 0.1, change the room
            if(newRoom != 'LAB'){
                let roomInx = rooms.findIndex(roomTemp => roomTemp.roomId === newRoom);
                try{
                    newRoom = rooms[Math.random() < 0.3 ? roomInx - 1: roomInx + 1].roomId;                             //to one with bigger capacity or lower capacity
                } catch(e){ 

                }
            }
        }
        else if(chance < 0.4){
            newStartTime = (Math.floor(Math.random() * (((endHour - startHour) / 60) - duration / 60)) * 60)        //if chance is less than 0.3, change the start time
            if(start == newStartTime)
                newStartTime += 60
        }
        else{
            newDayIndex = Math.floor(Math.random() * days.length);                                                  //if chance is less than 0.6, change the day
        }
  
        newSchedule[randomIndex] = {day: days[newDayIndex], startTime: newStartTime, finishTime:newStartTime + duration, courseId: coursename, room: newRoom, course: course};
                                                                                                                    //create the newSchedule 
        const newError = errorCalculateFunction(newSchedule);                                                       //calculate the error

        if(newError == 0){                                                                                          //if error is 0 then it's the perfect schedule
            console.log('Found with ' + newError + 'Error' + ' in' + iteration + 'th iteration');
            return newSchedule;
        }
        else if(newError > minimumError){                                                                           //if the error is better (it's negative so I used > sign)
            currentSchedule = newSchedule;                                                                          //save the schedule
            currentError = newError;                                                                                //save the error
            minimum = newSchedule;                                                                                  //save it in minimum as well
            minimumError = newError;                                                                                //save it in minimum as well    
         
            console.log(currentError+ ' ' + iteration + ' -SA');
        }
        else{
            if (Math.random() < Math.exp((newError - currentError) / temperature)) {                                //if the error is worse but the simulated accepts it
                currentSchedule = newSchedule;                                                                      //save the schedule
                currentError = newError;                                                                            //save the error
                console.log(currentError+' '+iteration + ' -SA')
            }
        }
  
      temperature *= cooling;                                                                                       //cool the the temperature
    }
  
    return minimum;                                                                                                 //return the minimum
  }




  //--------------------------------------------------------------------------------------------------------------------------------------------------------------
  //----------------------------------------  CONSTRUCTION AREA PLEASE DO NOT APPROACH IT WITHOUT YOUR SAFETY EQUIPMENTS  ----------------------------------------
  //--------------------------------------------------------------------------------------------------------------------------------------------------------------




  function calculateFitness(schedule) {
    return errorCalculateFunction(schedule); // Note the negative sign to convert error to fitness
  }
  
  function crossover(parent1, parent2) {
    const child = structuredClone(parent1); // Using structuredClone to avoid modifying the original parents
    const crossoverPoint = Math.floor(Math.random() * 5);
  
    let inx = 0;

    while(days.indexOf(parent2[inx].day) < crossoverPoint){ 
        inx++;
    }
    
    while(inx < parent2.length){
        child[inx] = parent2[inx]
        inx++;
    }
  
    return child;
  }
  
  function mutate(schedule, mutationRate) {
    const mutatedSchedule = structuredClone(schedule); // Using structuredClone to avoid modifying the original schedule
    const mutationChance = Math.random();
  
    if (mutationChance < mutationRate) {
      const randomIndex = Math.floor(Math.random() * mutatedSchedule.length);
      const day = mutatedSchedule[randomIndex].day;
      const start = mutatedSchedule[randomIndex].startTime;
      const end = mutatedSchedule[randomIndex].finishTime;
      const coursename = mutatedSchedule[randomIndex].courseId;
      const duration = mutatedSchedule[randomIndex].course.duration;
      let newRoom = mutatedSchedule[randomIndex].room;
      let newStartTime = start;
      let newDayIndex = days.findIndex((dayy) => dayy === day);
  
      const chance = Math.random();
  
      if (chance < 0.1) {
        let roomInx = rooms.findIndex((roomTemp) => roomTemp.roomId === newRoom);
        if(roomInx != -1 && roomInx != rooms.length - 1) {
          newRoom = rooms[roomInx + 1].roomId;
        }
      } 
      else if (chance < 0.6) {
        newStartTime = (Math.floor(Math.random() * (((endHour - startHour) / 60) - duration / 60)) * 60)
        if (start == newStartTime) newStartTime += 60;
      } 
      else {
        newDayIndex = Math.floor(Math.random() * days.length);
      }
  
      mutatedSchedule[randomIndex] = {
        day: days[newDayIndex],
        startTime: newStartTime,
        finishTime: newStartTime + duration,
        courseId: coursename,
        room: newRoom,
        course: mutatedSchedule[randomIndex].course,
      };
    }
  
    return mutatedSchedule;
  }
  
  
  async function geneticAlgorithmScheduler(initialSchedule, rooms, maxGenerations, mutationRate) {
    let parent1 = [...initialSchedule];
    let parent2 = [...initialSchedule];
    currentSchedule = [...initialSchedule];
    let currentFitness = calculateFitness(parent1);
  
    for (let generation = 0; generation < maxGenerations; generation++) {
      parent2 = mutate(parent2, mutationRate); // You can change this to another randomly selected schedule from the population
  
      const child = crossover(parent1, parent2);
      const mutatedChild = mutate(child, mutationRate);
  
      const childFitness = calculateFitness(child);
      const mutatedChildFitness = calculateFitness(mutatedChild);
  
      if (mutatedChildFitness > childFitness && mutatedChildFitness > currentFitness) {
        currentSchedule = mutatedChild;
        currentFitness = mutatedChildFitness;
      } else if (childFitness > currentFitness) {
        currentSchedule = child;
        currentFitness = childFitness;
      }
  
      console.log(`Generation ${generation}: Fitness ${currentFitness}`);
  
      if (currentFitness === 0) {
        console.log("Found optimal schedule with 0 error in generation", generation);
        break;
      }
    }
  
    return currentSchedule;
  } 


  async function hillClimbSpecified(initialSchedule, maxIterations){
    let currentSchedule = [...initialSchedule];
    let currentError = errorCalculateFunction(currentSchedule);

    if(currentError == 0)
        return initialSchedule;

    for(let iteration = 0; iteration < maxIterations; iteration++){                         //Randomly move one course to a new time slot
        
        let newSchedule = [...currentSchedule];
        const randomIndex1 = Math.floor(Math.random() * newSchedule.length);                 //select course
        var randomIndex2 = Math.floor(Math.random() * newSchedule.length); 

        while(randomIndex1 == randomIndex2){
            randomIndex2 = Math.floor(Math.random() * newSchedule.length);
        }


        var day1 = newSchedule[randomIndex1].day;
        var start1 = newSchedule[randomIndex1].startTime;
        var coursename1 = newSchedule[randomIndex1].courseId;
        var duration1 = newSchedule[randomIndex1].course.duration;
        var room1 = newSchedule[randomIndex1].room;
        const course1 = newSchedule[randomIndex1].course;


        var day2 = newSchedule[randomIndex2].day;
        var start2 = newSchedule[randomIndex2].startTime;
        var coursename2 = newSchedule[randomIndex2].courseId;
        var duration2 = newSchedule[randomIndex2].course.duration;
        var room2 = newSchedule[randomIndex2].room;
        const course2 = newSchedule[randomIndex2].course;

        newSchedule[randomIndex1] = {day: day2, startTime: start2, finishTime:start2+duration1, courseId: coursename1, room: room1, course: course1};
        newSchedule[randomIndex2] = {day: day1, startTime: start1, finishTime:start1+duration2, courseId: coursename2, room: room2, course: course2};

        const newError = errorCalculateFunction(newSchedule);                               //calculate the error

        console.log(newError+' '+iteration + ' -HCS')

        if(newError > currentError){                                                        //if the error is better (it's negative so I used > sign)
            currentSchedule = newSchedule;                                                  //take the new schedule
            currentError = newError;
            console.log(currentError+ ' ' + '%'+(Math.round((100*iteration/maxIterations) * 100) / 100).toFixed(2) + ' -HCS');
        }
        if(newError == 0){                                                                  //if error is 0 then it's the perfect schedule
            console.log('Found with ' + currentError + 'Error' + ' in' + iteration + 'th iteration');
            return currentSchedule;
        }
        

    }

    return currentSchedule;

}

