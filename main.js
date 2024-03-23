const fs = require('fs');
const readline = require('readline');
const { assignClassrooms } = require('./classroom');
const prompt = require('prompt-sync')({ sigint: true });

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const startHour = 0; // 9.00 AM
const endHour = 540; // 6.00 PM

const coursesFilePath = 'Fall_Courses.csv';
const roomsFilePath = 'Classroom_Capacities.csv';
var courses = [];
var rooms = [];

(async () => {
    
    var initialSchedule = await assignCoursesToRooms(coursesFilePath, roomsFilePath, courses, rooms);

    let initialSchedule2 = await hillClimbing(initialSchedule, rooms, 40000);                  //25000

    const optimizedSchedule =  await simulatedAnnealingScheduler(initialSchedule2, rooms, 0.99994, 0.001);          //0.99994

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

    var test = [];
    test.push('course_code,day,time,duration,classroom,grade,department,course_name,professor_name')

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

            if (dayA < dayB)
                return -1;

            if (dayA > dayB)
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

        test.push(course_code + ',' + day + ',' + time + ',' + duration + ',' + classroom + ',' + grade + ',' + department + ',' + course_name + ',' + professor_name);

    });

    console.log('The output is created.')

    // Write schedule to csv file
    const outputData = test.join('\n');
    fs.writeFileSync('Exam_Schedule.csv', outputData, 'utf-8');

})();

async function readFileLines(filePath){                                                         //take the input
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });
    const lines = [];

    for await(const line of rl) {
        lines.push(line);
    }

    return lines.slice(1);
}

async function assignCoursesToRooms(coursesFilePath, roomsFilePath, courses, rooms) {                 //firstly create try 0 schedule
    const coursesLines = await readFileLines(coursesFilePath);
    const roomsLines = await readFileLines(roomsFilePath);

    var tempRooms = roomsLines.map(line => ({ roomId: line.split(',')[0], roomSize: line.split(',')[1]}));
    for(const room of tempRooms){                                                              //get the rooms from the file and split them accordingly
        rooms.push(room);                                                                      //this for ensures that we're saving rooms to the global variable
    }
    rooms.sort((a, b) => a.roomSize - b.roomSize);

    let courseDetails = coursesLines.map(line => ({                                       //take the courses and rooms and create objects
        professorName: line.split(';')[9],
        courseId: line.split(';')[1],
        duration: parseInt((line.split(';')[5]).split('+')[0]) * 60 == 0 ? parseInt((line.split(';')[5]).split('+')[1]) * 60 : parseInt((line.split(';')[5]).split('+')[0]) * 60,
        numberOfStudents: parseInt((line.split(';')[3])),
        department: line.split(';')[10],
        year: parseInt(line.split(';')[7]),
        facetoface: line.split(';')[4],
        courseName: line.split(';')[2]
    }));

    for(const course of courseDetails){
        courses.push(course);
    }
    courses.sort((a,b) => a.duration - b.duration);

    let schedule = [];                                                                      //our schedule

    blockedDayIndex = -1;                                                                   //we assume no blockday
                                                                                            // Block a specific hour
    blockHour = prompt('Do you want to block a specific hour? (y/n): ').toLowerCase() === 'y';
    let blockedName,blockedProf,blockedDepartment,blockedMin,blockedNumber,blockedYear,blockFullName;
    blockedMin = 0;
    if(blockHour){
        flagBlocked = 0;
        blockedName = prompt('Name of the lecture? (Example: TIT101): ');
        blockedProf = prompt('Name of the proffesor? (Example: Dr. Öğr. Üyesi FADİ YILMAZ): ');
        blockedDepartment = prompt('Name of the department? (Example: CENG): ');
        blockedMin = prompt('How many minutes will it take? (Example: 60): ');
        blockedNumber = prompt('How many students will take? (Example: 78): ');
        blockedYear = prompt('Which year students will take the lecture? (Example: 2)');
        blockFullName = prompt('What is the full name of the lecture?');

        blockedNumber = parseInt(blockedNumber);
        blockedMin = parseInt(blockedMin);
        blockedYear = parseInt(blockedYear);

        try{
            courses.push({ professorName: blockedProf, courseId: blockedName, duration: blockedMin, numberOfStudents: blockedNumber, department: blockedDepartment, year: blockedYear,facetoface:'classroom', courseName:blockFullName});
        } catch(e){
            console.log('Invalid input. Blocking skipped.');
        }
    }

    for(const course of courses){
        if(course.facetoface === 'online'){
            continue;
        }
        else if(course.facetoface === 'lab'){
            schedule.push({day: days[Math.floor(Math.random() * days.length)], startTime: startHour, finishTime:course.duration, courseId: course.courseId, room: 'LAB', course: course});
        }
        else{
            let assigned = false;

            for(const room of rooms){                                                               //check every class
                if(assigned)
                    break;

                if(parseInt(room.roomSize) < course.numberOfStudents)                                      //if the size is not enough skip the class
                    continue;

                schedule.push({day: days[Math.floor(Math.random() * days.length)], startTime: startHour, finishTime:course.duration, courseId: course.courseId, room: room.roomId, course: course});
                assigned = true;

            }
        }
    }

    return schedule; //schedule
}

function errorCalculateFunction(schedule){                                          //error calculation function
    let error = 0;

    for(let i = 0; i < schedule.length; i++){

        const day1 = schedule[i].day;
        const start1 = schedule[i].startTime;
        const end1 = schedule[i].finishTime;
        const coursename1 = schedule[i].courseId;
        const duration1 = schedule[i].course.duration;
        const prof1 = schedule[i].course.professorName;

        for(let j = i + 1; j < schedule.length; j++){

            const day2 = schedule[j].day;

            if(day1 === day2){

                const duration2 = schedule[j].course.duration;

                if(duration1 != 0 && duration2 != 0){
                    
                    const coursename2 = schedule[j].courseId;

                    if(coursename1 !== coursename2){

                        const start2 = schedule[j].startTime;
                        const end2 = schedule[j].finishTime;

                        const prof2 = schedule[j].course.professorName;

                        if((start1 <= end2 && end1 >= start2) && ((start1 == end2 ? end1 != start2+duration1+duration2: true) && (start2 == end1 ? end2 != start1+duration1+duration2: true))){

                            if(schedule[i].course.professorName === schedule[j].course.professorName){
                                error -= 50; //lecturer conflict 
                            }
    
                            if(schedule[i].course.department === schedule[j].course.department){
                                if(parseInt(schedule[i].course.year) === parseInt(schedule[j].course.year)){
                                    error -= 150; //year conflict 
                                }
                                else if(Math.abs(parseInt(schedule[i].course.year) - parseInt(schedule[j].course.year)) == 1){
                                    error -= 10
                                }
                            }

                            if(schedule[i].room === schedule[j].room && schedule[i].room !== 'LAB'){
                                error -= 50; //class conflict 
                            }
                        }

                        else if((start1 == end2 || start2 == end1) && prof1 === prof2 && duration1+duration2 > 240){
                            error -= 50;
                        }
                    }
                }
            }
        }
    }
    return error;
}

async function hillClimbing(initialSchedule, rooms, maxIterations){
    let currentSchedule = [...initialSchedule];
    let currentError = errorCalculateFunction(currentSchedule);

    if(currentError == 0)
        return initialSchedule;

    for(let iteration = 0; iteration < maxIterations; iteration++){                         //Randomly move one course to a new time slot
        
        let newSchedule = [...currentSchedule];
        const randomIndex = Math.floor(Math.random() * newSchedule.length);                 //select course
    
        var day = newSchedule[randomIndex].day;
        var start = newSchedule[randomIndex].startTime;
        var end = newSchedule[randomIndex].finishTime;
        var coursename = newSchedule[randomIndex].courseId;
        var duration = newSchedule[randomIndex].course.duration;
        var room = newSchedule[randomIndex].room;
        const course = newSchedule[randomIndex].course;

        let newRoom = newSchedule[randomIndex].room;                                        //hold the current class
        let newStartTime = start;
        let newDayIndex = days.findIndex(dayy => dayy === day);

        let chance = Math.random();

        if(chance < 0.01){
            let roomInx = rooms.findIndex(roomTemp => roomTemp.roomId === newRoom);
            try{
                newRoom = rooms[Math.random() < 0.3 ? roomInx - 1: roomInx + 1].roomId;
            } catch(e){

            }
        }
        else if(chance < 0.6){
            newStartTime = (Math.floor(Math.random() * (((endHour - startHour) / 60) - duration / 60)) * 60)
            if(start == newStartTime)
                newStartTime += 60
        }
        else{
            newDayIndex = Math.floor(Math.random() * days.length); 
        }
                                                                                            //select random new day and our
        newSchedule[randomIndex] = {day: days[newDayIndex], startTime: newStartTime, finishTime:newStartTime + duration, courseId: coursename, room: newRoom, course: course};
                                                                                            //add to the new schedule
        
        const newError = errorCalculateFunction(newSchedule);                      //calculate the error

        if(newError > currentError){                                                        //if the error is better (it's negative so I used > sign)
            currentSchedule = newSchedule;                                                  //take the new schedule
            currentError = newError;
            console.log(currentError+ ' ' + '%'+(Math.round((100*iteration/maxIterations) * 100) / 100).toFixed(2) + ' -HC');
        }
        if(newError == 0){                                                                  //if error is 0 then it's the perfect schedule
            console.log('Found with ' + currentError + ' error' + ' in ' + iteration + 'th iteration');
            return currentSchedule;
        }

    }

    return currentSchedule;

}

async function simulatedAnnealingScheduler(initialSchedule, rooms, cooling, finish) {
    let currentSchedule = [...initialSchedule];
    let currentError = errorCalculateFunction(currentSchedule);

    let minimum;

    temperature = 10;
    let iteration = 0;
  
    while (temperature > finish) {
        iteration++;
        let newSchedule = [...currentSchedule];
        const randomIndex = Math.floor(Math.random() * newSchedule.length);
  
        var day = newSchedule[randomIndex].day;
        var start = newSchedule[randomIndex].startTime;
        var end = newSchedule[randomIndex].finishTime;
        var coursename = newSchedule[randomIndex].courseId;
        var duration = newSchedule[randomIndex].course.duration;
        var room = newSchedule[randomIndex].room;
        const course = newSchedule[randomIndex].course;
  
        let newRoom = newSchedule[randomIndex].room;
        let newStartTime = start;
        let newDayIndex = days.findIndex(dayy => dayy === day);
  
        let chance = Math.random();
  
        if (chance < 0.1) {
            let roomInx = rooms.findIndex(roomTemp => roomTemp.roomId === newRoom);
            try{
                newRoom = rooms[Math.random() < 0.3 ? roomInx - 1: roomInx + 1].roomId;
            } catch(e){

            }
        }
        else if (chance < 0.4) {
            newStartTime = (Math.floor(Math.random() * (((endHour - startHour) / 60) - duration / 60)) * 60)
            if (start == newStartTime)
                newStartTime += 60
        }
        else {
            newDayIndex = Math.floor(Math.random() * days.length);
        }
  
        newSchedule[randomIndex] = {day: days[newDayIndex], startTime: newStartTime, finishTime:newStartTime + duration, courseId: coursename, room: newRoom, course: course};
  
        const newError = errorCalculateFunction(newSchedule);

        if(newError == 0){                                                                  //if error is 0 then it's the perfect schedule
            console.log('Found with ' + newError + 'Error' + ' in' + iteration + 'th iteration');
            return newSchedule;
        }
        else if(newError > currentError){                                                        //if the error is better (it's negative so I used > sign)
            currentSchedule = newSchedule;
            minimum = newSchedule;                                                 
            currentError = newError;
            console.log(currentError+ ' ' + iteration + ' -SA');
        }
        else{
            if (Math.random() < Math.exp((newError - currentError) / temperature)) {
                currentSchedule = newSchedule;
                currentError = newError;
                console.log(currentError+' '+iteration + ' -SA')
            }
        }
  
      temperature *= cooling;
    }
  
    return minimum;
  }


  //----------------------------------------

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

        const newError = errorCalculateFunction(newSchedule);                      //calculate the error

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