const fs = require('fs');
const readline = require('readline');
const { start } = require('repl');
const {scheduler} = require('timers/promises');
const prompt = require('prompt-sync')({ sigint: true });

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const startHour = 0; // 9.00 AM
const endHour = 540; // 6.00 PM

let outputSchedule = [];
const coursesFilePath = 'Fall_Courses.csv';
const roomsFilePath = 'Classroom_Capacities.csv';
var courses = [];
var rooms = [];

(async () => {
    var initialSchedule = await assignCoursesToRooms(coursesFilePath, roomsFilePath, courses, rooms);

    const optimizedSchedule = await hillClimbingScheduler(initialSchedule, courses, rooms, 50000);

    var test = [];
    test.push('course_code,day,time,duration,classroom,grade,department,course_name')

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

        test.push(course_code + ',' + day + ',' + time + ',' + duration + ',' + classroom + ',' + grade + ',' + department + ',' + course_name);

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

    var tempRooms = roomsLines.map(line => ({ roomId: line.split(',')[0], roomSize: line.split(',')[1], nextAvailableTime: startHour * 60, nextAvailableDay: 0, blockedTime: Infinity }));
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

    return schedule;
}

function errorCalculateFunction(schedule){                                          //error calculation function
    let error = 0;

    for(let i = 0; i < schedule.length; i++){

        const day1 = schedule[i].day;
        const start1 = schedule[i].startTime;
        const end1 = schedule[i].finishTime;
        const coursename1 = schedule[i].courseId;
        const duration1 = schedule[i].course.duration;

        if(coursename1.substr(0,4) === 'CENG'){
            if(start1 < 60){
                error -= 100;
            }
        }

        for(let j = i + 1; j < schedule.length; j++){

            const day2 = schedule[j].day;

            if(day1 === day2){

                const duration2 = schedule[j].course.duration;

                if(duration1 != 0 && duration2 != 0){
                    
                    const coursename2 = schedule[j].courseId;

                    if(coursename1 !== coursename2){

                        const start2 = schedule[j].startTime;
                        const end2 = schedule[j].finishTime;

                        if((start1 <= end2 && end1 >= start2) || (start2 <= end1 && end2 >= start1)){

                            if(schedule[i].course.professorName === schedule[j].course.professorName){
                                error -= 100; //lecturer conflict 
                            }
    
                            if(schedule[i].course.department === schedule[j].course.department){
                                if(parseInt(schedule[i].course.year) === parseInt(schedule[j].course.year)){
                                    error -= 100; //year conflict 
                                }
                            }

                            if(schedule[i].room === schedule[j].room && schedule[i].room !== 'LAB'){
                                error -= 150; //class conflict 
                            }
                        }
                    }
                }
            }
        }
    }
    return error;
}

function roundNearest60(num){
    return Math.round(num / 60) * 60;
}

async function hillClimbingScheduler(initialSchedule, courses, rooms, maxIterations){
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

        if(iteration>maxIterations*0.9){

            var flag = false;
    
            for(let j = 0; j < newSchedule.length; j++){

                if(j != randomIndex){
                    const day2 = newSchedule[j].day;
        
                    if(day === day2){
                        const duration2 = newSchedule[j].course.duration;

                        if(duration != 0 && duration2 != 0){
                            const coursename2 = newSchedule[j].courseId;

                            if(coursename !== coursename2){
                                const start2 = newSchedule[j].startTime;
                                const end2 = newSchedule[j].finishTime;

                                if((start < end2 && end > start2) || (start2 < end && end2 > start)){
                                    let room2 = newSchedule[j].room;

                                    if(newSchedule[randomIndex].course.professorName === newSchedule[j].course.professorName){
                                        let counter = 0;

                                        while(counter < 20 && !flag){
                                            if(Math.random < 0.3){
                                                const newDayIndex = Math.floor(Math.random() * days.length); 
                                                newSchedule[randomIndex] = {day: days[newDayIndex], startTime: start, finishTime:end, courseId: coursename, room: room, course: course};
                                            }
                                            else{
                                                let newStartTime = (start + (Math.floor(Math.random() * (9 - (end + start) / 60)) * 60) % 540 )
                                                if(start == newStartTime)
                                                    newStartTime += 60
                                                newSchedule[randomIndex] = {day: day, startTime: newStartTime, finishTime:newStartTime + duration, courseId: coursename, room: room, course: course};
                                            }
    
                                            const newError = errorCalculateFunction(newSchedule);                      //calculate the error
    
                                            if(newError > currentError){                                                        //if the error is better (it's negative so I used > sign)
                                                currentSchedule = newSchedule;                                                  //take the new schedule
                                                currentError = newError;
                                                console.log(currentError+ ' ' + '%'+(Math.round((100*iteration/maxIterations) * 100) / 100).toFixed(2));
                                                console.log('prof hatası')
                                                flag = true;
                                                day = newSchedule[randomIndex].day;
                                                start = newSchedule[randomIndex].startTime;
                                                end = newSchedule[randomIndex].finishTime;
                                            }
                                            if(newError == 0){                                                                  //if error is 0 then it's the perfect schedule
                                                console.log('Found with ' + currentError + 'Error' + ' in' + iteration + 'th iteration');
                                                return currentSchedule;
                                            }

                                            counter++;

                                        }

                                        flag = true;

                                    }
            
                                    else if(newSchedule[randomIndex].course.department === newSchedule[j].course.department){
                                        if(newSchedule[randomIndex].course.year === newSchedule[j].course.year){

                                            let counter = 0;

                                            while(counter < 20 && !flag){
                                                if(Math.random < 0.3){
                                                    const newDayIndex = Math.floor(Math.random() * days.length); 
                                                    newSchedule[randomIndex] = {day: days[newDayIndex], startTime: start, finishTime:end, courseId: coursename, room: room, course: course};
                                                }
                                                else{
                                                    let newStartTime = (start + (Math.floor(Math.random() * (9 - (end + start) / 60)) * 60) % 540 )
                                                    if(start == newStartTime)
                                                        newStartTime += 60
                                                    newSchedule[randomIndex] = {day: day, startTime: newStartTime, finishTime:newStartTime + duration, courseId: coursename, room: room, course: course};
                                                }
    
                                                const newError = errorCalculateFunction(newSchedule);                      //calculate the error
            
                                                if(newError > currentError){                                                        //if the error is better (it's negative so I used > sign)
                                                    currentSchedule = newSchedule;                                                  //take the new schedule
                                                    currentError = newError;
                                                    console.log(currentError+ ' ' + '%'+(Math.round((100*iteration/maxIterations) * 100) / 100).toFixed(2));
                                                    console.log('sınıf hatası')
                                                    flag = true;
                                                    day = newSchedule[randomIndex].day;
                                                    start = newSchedule[randomIndex].startTime;
                                                    end = newSchedule[randomIndex].finishTime;
                                                }
                                                if(newError == 0){                                                                  //if error is 0 then it's the perfect schedule
                                                    console.log('Found with ' + currentError + 'Error' + ' in' + iteration + 'th iteration');
                                                    return currentSchedule;
                                                }

                                                counter++;

                                            }

                                            flag = true;

                                        }
                                    }
        
                                    else if(room === room2 && room !== 'LAB'){

                                        let counter = 0;

                                        while(counter < 20 && !flag){
                                            let newRoom = room;                                                                 //hold the current class
                                            let roomInx = rooms.findIndex(roomTemp => roomTemp.roomId === room);
                                            if(roomInx != -1 && roomInx != rooms.length-1){
                                                newRoom = rooms[rooms.findIndex(roomTemp => roomTemp.roomId === room) + 1].roomId;
                                            }
                                                                                                                                //select random new day and our
                                            newSchedule[randomIndex] = {day: day, startTime: start, finishTime:end, courseId: coursename, room: newRoom, course: course};
                                                                                                                                //add to the new schedule
                                            const newError = errorCalculateFunction(newSchedule);                      //calculate the error

                                            if(newError > currentError){                                                        //if the error is better (it's negative so I used > sign)
                                                currentSchedule = newSchedule;                                                  //take the new schedule
                                                currentError = newError;
                                                console.log(currentError+ ' ' + '%'+(Math.round((100*iteration/maxIterations) * 100) / 100).toFixed(2));
                                                console.log('oda hatası')
                                                flag = true;
                                                room = newSchedule[randomIndex].room;
                                            }
                                            if(newError == 0){                                                                  //if error is 0 then it's the perfect schedule
                                                console.log('Found with ' + currentError + 'Error' + ' in' + iteration + 'th iteration');
                                                return currentSchedule;
                                            }

                                            counter++;

                                        }

                                        flag = true;
                                    
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if(!flag){
                let newRoom = room;                                                                                         //hold the current class

                const newDayIndex = Math.floor(Math.random() * days.length); 
                let newStartTime = (start + (Math.floor(Math.random() * (9 - (end + start) / 60)) * 60) % 540 )

                if(Math.random() < 0.1){                                                              
                    let roomInx = rooms.findIndex(roomTemp => roomTemp.roomId === room);
                    if(roomInx != -1 && roomInx != rooms.length-1){
                        newRoom = rooms[rooms.findIndex(roomTemp => roomTemp.roomId === room) + 1].roomId;
                    }
                }
                                                                                                    //select random new day and our
                newSchedule[randomIndex] = {day: days[newDayIndex], startTime: newStartTime, finishTime:newStartTime + duration, courseId: coursename, room: newRoom, course: course};
                                                                                                    //add to the new schedule
                const newError = errorCalculateFunction(newSchedule);                      //calculate the error

                if(newError > currentError){                                                        //if the error is better (it's negative so I used > sign)
                    currentSchedule = newSchedule;                                                  //take the new schedule
                    currentError = newError;
                    console.log(currentError+ ' ' + '%'+(Math.round((100*iteration/maxIterations) * 100) / 100).toFixed(2));
                    day = newSchedule[randomIndex].day;
                    start = newSchedule[randomIndex].startTime;
                    end = newSchedule[randomIndex].finishTime;
                    room = newSchedule[randomIndex].room;
                }
                if(newError == 0){                                                                  //if error is 0 then it's the perfect schedule
                    console.log('Found with ' + currentError + 'Error' + ' in' + iteration + 'th iteration');
                    return currentSchedule;
                }
            }
        }
        else{
            let newRoom = newSchedule[randomIndex].room;                                                                                         //hold the current class
            let newStartTime = start;
            let newDayIndex = days.findIndex(dayy => dayy === day);

            let chance = Math.random();

            if(chance < 0.01){
                let roomInx = rooms.findIndex(roomTemp => roomTemp.roomId === newRoom);
                if(roomInx != -1 && roomInx != rooms.length-1){
                    newRoom = rooms[roomInx + 1].roomId;
                }
            }
            else if(chance < 0.6){
                newStartTime = (start + (Math.floor(Math.random() * (9 - (end + start) / 60)) * 60) % 540 )
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
                console.log(currentError+ ' ' + '%'+(Math.round((100*iteration/maxIterations) * 100) / 100).toFixed(2));
            }
            if(newError == 0){                                                                  //if error is 0 then it's the perfect schedule
                console.log('Found with ' + currentError + 'Error' + ' in' + iteration + 'th iteration');
                return currentSchedule;
            }
        }

    }
    return currentSchedule;
}


