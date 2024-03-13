const fs = require('fs');
const readline = require('readline');
const {scheduler} = require('timers/promises');
const prompt = require('prompt-sync')({ sigint: true });

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const startHour = 8; // 8.00 AM
const endHour = 17; // 5.00 PM

let blockHourName = 'noBlockedHour';                                                            //if no blockedHour assigned

function timeToMinutes(time){                                                                   //time to min
    const [hour, minute] = time.match(/(\d+):(\d+)/).slice(1, 3);
    return parseInt(hour) * 60 + parseInt(minute);
}

function minutesToTime(minutes){                                                                //min to time
    const hour = Math.floor(minutes / 60) % 24;
    const minute = minutes % 60;
    return `${hour < 10 ? '0' + hour : hour}:${minute === 0 ? '00' : minute < 10 ? '0' + minute : minute}`;
}

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

async function assignCoursesToRooms(coursesFilePath, roomsFilePath,courseDetails, courses, rooms) {                 //firstly create try 0 schedule
    const coursesLines = await readFileLines(coursesFilePath);
    const roomsLines = await readFileLines(roomsFilePath);

    var tempRooms = roomsLines.map(line => ({ roomId: line.split(',')[0], roomSize: line.split(',')[1], nextAvailableTime: startHour * 60, nextAvailableDay: 0, blockedTime: Infinity }));
    for(const room of tempRooms){                                                              //get the rooms from the file and split them accordingly
        rooms.push(room);                                                                      //this for ensures that we're saving rooms to the global variable
    }
    rooms.sort((a, b) => a.roomSize - b.roomSize);

    const tempCourseDetails = coursesLines.map(line => ({                                       //take the courses and rooms and create objects
        professorName: line.split(';')[9],
        courseId: line.split(';')[1],
        duration: parseInt((line.split(';')[5]).split('+')[0]) * 60 == 0 ? parseInt((line.split(';')[5]).split('+')[1]) * 60 : parseInt((line.split(';')[5]).split('+')[0]) * 60,
        numberOfStudents: parseInt((line.split(';')[3])),
        department: line.split(';')[10],
        year: line.split(';')[7],
        facetoface: line.split(';')[4],
        courseName: line.split(';')[2]
    }));

    for(const detail of tempCourseDetails){
        courseDetails.push(detail);                                                         //just like the rooms this for ensures we're saving the data
    }

    let schedule = [];                                                                      //our schedule

    blockedDayIndex = -1;                                                                   //we assume no blockday
    let flagBlocked = 0;                                                                    //isBlocked?

                                                                                            // Block a specific hour
    blockHour = prompt('Do you want to block a specific hour? (y/n): ').toLowerCase() === 'y';
    let blockedName,blockedProf,blockedDepartment,blockedMin,blockedNumber,blockedYear;
    blockedMin = 0;
    if(blockHour){
        flagBlocked = 0;
        blockedName = prompt('Name of the event? (Example: TIT101): ');
        blockedProf = prompt('Name of the proffesor? (Example: Dr. Öğr. Üyesi FADİ YILMAZ): ');
        blockedDepartment = prompt('Name of the department? (Example: BİLGİSAYAR MÜH.): ');
        blockedMin = prompt('How many minutes will it take? (Example: 60): ');
        blockedNumber = prompt('How many students will take? (Example: 78): ');
        blockedYear = prompt('Which year students will take the lecture? (Example: 2)');
        
        blockedNumber = parseInt(blockedNumber);
        blockedMin = parseInt(blockedMin);
        blockedYear = parseInt(blockedYear);

        try{
            courseDetails.push({ professorName: blockedProf, courseId: blockedName, duration: blockedMin, numberOfStudents: blockedNumber, department: blockedDepartment, year: blockedYear});
        } catch(e){
            console.log('Invalid input. Blocking skipped.');
        }
    }
                                                                                                //remove the same id lectures (temporary)
    for(const {numberOfStudents, professorName, courseId, duration,department,year,facetoface} of courseDetails){
        let course = courses.find(c => c.name === courseId);

        if(!course){
            if(duration > 0 && (facetoface === 'classroom' || facetoface === 'lab')){
                course = { name: courseId, count: numberOfStudents, std: year, prof: professorName,department: department};
                courses.push(course);
            }
        }
        else{
            //departman kontrol ona göre ekleme yoksa aynı departmansa aynı ana koy
        }
    }

    backup = JSON.parse(JSON.stringify(courses));                                                   //backup of the courses

    for(const {numberOfStudents, professorName, courseId, duration,department,year,facetoface} of courseDetails){
        let tempInx;                                                                                //create the first initial guess without any restriction

        tempInx = courses.findIndex(course => course.name === courseId);                            //find the index

        if(tempInx != -1){                                                                          //if it's found

            if (tempInx == 0)                                                                       //if it's the first, splice the first
                courses.splice(0, 1);

            else{
                courses.splice(tempInx, 1);                                                   //esle splice the course
            }
            
            if(facetoface === 'lab'){
                schedule.push(`${days[Math.floor(Math.random() * days.length)]},${minutesToTime(startHour*60)} - ${minutesToTime(startHour*60 + duration)}, ${courseId} - Room LAB`);
            }
            else{
                let assigned = false;

                for(const room of rooms){                                                               //check every class
                    if(assigned)
                        break;

                    if(parseInt(room.roomSize) < numberOfStudents)                                      //if the size is not enough skip the class
                        continue;

                    const slot = findNextAvailableSlot(duration, room);                                 //find available time

                    if(slot){                                                                           //if so place the lecture
                        const {dayIndex, startTime, endTime} = slot;

                        schedule.push(`${days[dayIndex]},${minutesToTime(startTime)} - ${minutesToTime(endTime)}, ${courseId} - Room ${room.roomId}`);
                        room.nextAvailableTime = endTime;
                        room.nextAvailableDay = dayIndex;
                        room.blockedTime = Math.max(room.blockedTime, endTime);
                        assigned = true;
                    }

                }

                if(!assigned) {
                    notAssaignedCourseExist = true;
                }
            }
        }
    }

    return schedule;
}

function findNextAvailableSlot(duration, room){                                             //for finding the next slot of class 
    let dayIndex = room.nextAvailableDay;
    let startTime = room.nextAvailableTime;

    while(dayIndex < days.length % (days.length+1)){
        const endTime = startTime + duration;

        if(startTime >= startHour * 60 && endTime <= endHour * 60)
            return { dayIndex, startTime, endTime };

        dayIndex++;
        startTime = startHour * 60;
    }
    return null; 
}

function errorCalculateFunction(schedule, courses){                                          //error calculation function
    let error = 0;

    for(let i = 0; i < schedule.length; i++){

        const [day1, time1, course1] = schedule[i].split(',').map(str => str.trim());
        const [start1, end1] = time1.split(' - ').map(str => str.trim());
        const [coursename1, Roomroom1] = course1.split(' - ').map(str => str.trim());
        const [trash, room1] = Roomroom1.split(' ').map(str => str.trim());                   //it was 'Room C510' so I did one more trim for the th Room word

        const start1Minutes = timeToMinutes(start1);
        const end1Minutes = timeToMinutes(end1);

        var index1 = courses.findIndex(course => course.name === coursename1);

        for(let j = i + 1; j < schedule.length; j++){

            const [day2, time2, course2] = schedule[j].split(',').map(str => str.trim());

            if(day1 === day2){

                const [coursename2, Roomroom2] = course2.split(' - ').map(str => str.trim());
                var index2 = courses.findIndex(course => course.name === coursename2);

                if(courses[index1].duration != 0 && courses[index2].duration != 0){
                    if(coursename1 !== coursename2){

                        const [start2, end2] = time2.split(' - ').map(str => str.trim());
                        const [trashh, room2] = Roomroom2.split(' ').map(str => str.trim());                   //it was 'Room C510' so I did one more trim for the th Room word

                        const start2Minutes = timeToMinutes(start2);
                        const end2Minutes = timeToMinutes(end2);

                        if((start1Minutes < end2Minutes && end1Minutes > start2Minutes) || (start2Minutes < end1Minutes && end2Minutes > start1Minutes)){
                            if(courses[index1].prof === courses[index2].prof){
                                error -= 100; //lecturer conflict 
                            }
    
                            if(courses[index1].department === courses[index2].department){
                                if(parseInt(courses[index1].std) == parseInt(courses[index2].std)){
                                    error -= 100; //year conflict 
                                }
                            }

                            if(room1 === room2 && room1 !== 'LAB'){
                                error -= 200; //class conflict 
                            }
                        }
                        else{
                            if(courses[index1].department === courses[index2].department){
                                if(parseInt(courses[index1].std) == parseInt(courses[index2].std)){
                                    if(start1Minutes < start2Minutes){
                                        error -= (start2Minutes - end1Minutes)/10;
                                    }
                                    else{
                                        error -= (start1Minutes - end2Minutes)/10;
                                    }
                                }
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
    let currentError = errorCalculateFunction(currentSchedule, courses);

    if(currentError == 0)
        return initialSchedule;

    for(let iteration = 0; iteration < maxIterations; iteration++){                         //Randomly move one course to a new time slot
        
        let newSchedule = [...currentSchedule];
        const randomIndex = Math.floor(Math.random() * newSchedule.length);                 //select course

        const [day, time, course] = newSchedule[randomIndex].split(',').map(str => str.trim());
        const [start, end] = time.split(' - ').map(str => str.trim());
        const [coursename, Roomroom] = course.split(' - ').map(str => str.trim());
        const [trash, room] = Roomroom.split(' ').map(str => str.trim());                   //it was 'Room C510' so I did one more trim for the th Room word

        const start1Minutes = timeToMinutes(start);
        const end1Minutes = timeToMinutes(end);
        var index1 = courses.findIndex(course => course.name === coursename);

        if(iteration>maxIterations*0.95){

            var flag = false;
    
            for(let j = 0; j < newSchedule.length; j++){

                if(j != randomIndex){
                    const [day2, time2, course2] = newSchedule[j].split(',').map(str => str.trim());
                    const [coursename2, Roomroom2] = course2.split(' - ').map(str => str.trim());
                    var index2 = courses.findIndex(course => course.name === coursename2);
        
                    if(day === day2){
                        if(courses[index1].duration != 0 && courses[index2].duration != 0){

                            const [trashh, room2] = Roomroom2.split(' ').map(str => str.trim());                   //it was 'Room C510' so I did one more trim for the th Room word

                            if(coursename !== coursename2){

                                const [start2, end2] = time2.split(' - ').map(str => str.trim());
                                const start2Minutes = timeToMinutes(start2);
                                const end2Minutes = timeToMinutes(end2);

                                if((start1Minutes < end2Minutes && end1Minutes > start2Minutes) || (start2Minutes < end1Minutes && end2Minutes > start1Minutes)){
                                    if(courses[index1].prof === courses[index2].prof){

                                        let counter = 0;

                                        while(counter < 10 && !flag){
                                            if(Math.random < 0.3){
                                                const newDayIndex = Math.floor(Math.random() * days.length); 
                                                newSchedule[randomIndex] = `${days[newDayIndex]},${start} - ${end}, ${coursename} - Room ${room}`;
                                                                                                                                    //add to the new schedule
                                            }
                                            else{
                                                const newStartTime = startHour*60 +  roundNearest60(Math.round(Math.random() * ((endHour - startHour) * 60 - end1Minutes + start1Minutes)))
                                                newSchedule[randomIndex] = `${day},${minutesToTime(newStartTime)} - ${minutesToTime(newStartTime + timeToMinutes(end) - timeToMinutes(start))}, ${coursename} - Room ${room}`;
                                                                                                                                    //add to the new schedule
                                            }
    
                                            const newError = errorCalculateFunction(newSchedule, courses);                      //calculate the error
    
                                            if(newError > currentError){                                                        //if the error is better (it's negative so I used > sign)
                                                currentSchedule = newSchedule;                                                  //take the new schedule
                                                currentError = newError;
                                                console.log(currentError+ ' ' + '%'+(Math.round((100*iteration/maxIterations) * 100) / 100).toFixed(2));
                                                console.log('prof hatası')
                                                flag = true;
                                            }
                                            if(newError == 0){                                                                  //if error is 0 then it's the perfect schedule
                                                console.log('Found with ' + currentError + 'Error' + ' in' + iteration + 'th iteration');
                                                return currentSchedule;
                                            }

                                            counter++;

                                        }

                                        flag = true;

                                    }
            
                                    else if(courses[index1].department === courses[index2].department){
                                        if(parseInt(courses[index1].std) == parseInt(courses[index2].std)){

                                            let counter = 0;

                                            while(counter < 10 && !flag){
                                                if(Math.random < 0.3){
                                                    const newDayIndex = Math.floor(Math.random() * days.length); 
                                                    newSchedule[randomIndex] = `${days[newDayIndex]},${start} - ${end}, ${coursename} - Room ${room}`;
                                                                                                                                        //add to the new schedule
                                                }
                                                else{
                                                    const newStartTime = startHour*60 +  roundNearest60(Math.round(Math.random() * ((endHour - startHour) * 60 - end1Minutes + start1Minutes)))
                                                    newSchedule[randomIndex] = `${day},${minutesToTime(newStartTime)} - ${minutesToTime(newStartTime + timeToMinutes(end) - timeToMinutes(start))}, ${coursename} - Room ${room}`;
                                                                                                                                        //add to the new schedule 
                                                }
    
                                                const newError = errorCalculateFunction(newSchedule, courses);                      //calculate the error
            
                                                if(newError > currentError){                                                        //if the error is better (it's negative so I used > sign)
                                                    currentSchedule = newSchedule;                                                  //take the new schedule
                                                    currentError = newError;
                                                    console.log(currentError+ ' ' + '%'+(Math.round((100*iteration/maxIterations) * 100) / 100).toFixed(2));
                                                    console.log('sınıf hatası')
                                                    flag = true;
                                                    
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

                                        while(counter < 10 && !flag){
                                            let newRoom = room;                                                                 //hold the current class
                                            let roomInx = rooms.findIndex(roomTemp => roomTemp.roomId === room);
                                            if(roomInx != -1 && roomInx != rooms.length-1){
                                                newRoom = rooms[rooms.findIndex(roomTemp => roomTemp.roomId === room) + 1].roomId;
                                            }
                                                                                                                                //select random new day and our
                                            newSchedule[randomIndex] = `${day},${start} - ${end}, ${coursename} - Room ${newRoom}`;
                                                                                                                                //add to the new schedule
                                            const newError = errorCalculateFunction(newSchedule, courses);                      //calculate the error

                                            if(newError > currentError){                                                        //if the error is better (it's negative so I used > sign)
                                                currentSchedule = newSchedule;                                                  //take the new schedule
                                                currentError = newError;
                                                console.log(currentError+ ' ' + '%'+(Math.round((100*iteration/maxIterations) * 100) / 100).toFixed(2));
                                                console.log('oda hatası')
                                                flag = true;
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
                const newStartTime = startHour*60 +  roundNearest60(Math.round(Math.random() * ((endHour - startHour) * 60 - end1Minutes + start1Minutes)))
                if(Math.random() < 0.01){
                    let roomInx = rooms.findIndex(roomTemp => roomTemp.roomId === room);
                    if(roomInx != -1 && roomInx != rooms.length-1){
                        newRoom = rooms[rooms.findIndex(roomTemp => roomTemp.roomId === room) + 1].roomId;
                    }
                }
                                                                                                    //select random new day and our
                newSchedule[randomIndex] = `${days[newDayIndex]},${minutesToTime(newStartTime)} - ${minutesToTime(newStartTime + end1Minutes - start1Minutes)}, ${coursename} - Room ${newRoom}`;
                                                                                                    //add to the new schedule
                const newError = errorCalculateFunction(newSchedule, courses);                      //calculate the error

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
            else{
                iteration-=3;
            }
        }
        else{
            let newRoom = room;                                                                                         //hold the current class
            let newStartTime = start1Minutes;
            let newDayIndex = days.findIndex(dayy => dayy === day);

            let chance = Math.random();

            if(chance < 0.1){
                let roomInx = rooms.findIndex(roomTemp => roomTemp.roomId === room);
                if(roomInx != -1 && roomInx != rooms.length-1){
                    newRoom = rooms[rooms.findIndex(roomTemp => roomTemp.roomId === room) + 1].roomId;
                }
            }

            else if(chance < 0.6){
                newStartTime = startHour*60 +  roundNearest60(Math.round(Math.random() * ((endHour - startHour) * 60 - end1Minutes + start1Minutes)))
                if(start1Minutes == newStartTime)
                    newStartTime += 60
            }
            else{
                newDayIndex = Math.floor(Math.random() * days.length); 
            }
                                                                                                //select random new day and our
            newSchedule[randomIndex] = `${days[newDayIndex]},${minutesToTime(newStartTime)} - ${minutesToTime(newStartTime + end1Minutes - start1Minutes)}, ${coursename} - Room ${newRoom}`;
                                                                                                //add to the new schedule
            const newError = errorCalculateFunction(newSchedule, courses);                      //calculate the error

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



const coursesFilePath = 'Fall_Courses.csv';
const roomsFilePath = 'Classroom_Capacities.csv';
var courses = [];
var rooms = [];
var courseDetails = [];
var backup;


(async () => {
    var initialSchedule = await assignCoursesToRooms(coursesFilePath, roomsFilePath,courseDetails, courses, rooms);

    const optimizedSchedule = await hillClimbingScheduler(initialSchedule, backup, rooms, 5000);

    var test = [];
    test.push('course_code,day,time,duration,classroom,grade,department,course_name')

    optimizedSchedule
    .sort(
        (a, b) => {
            let timeA = timeToMinutes(a.split(',')[1].split(' - ')[0]);
            let timeB = timeToMinutes(b.split(',')[1].split(' - ')[0]);

            if (timeA < timeB)
                return -1;

            if (timeA > timeB)
                return 1;

            return 0;
        }
    )
    .sort(
        (a, b) => {
            let dayA = days.indexOf(a.split(',')[0]);
            let dayB = days.indexOf(b.split(',')[0]);

            if (dayA < dayB)
                return -1;

            if (dayA > dayB)
                return 1;

            return 0;
        }
    )
    .forEach(entry => {
        let course_code = entry.split(',')[2].split(' - ')[0].replace(/\s/g, "");;
        var inx = courseDetails.findIndex(course => course.courseId === course_code);

        let classroom = entry.split(',')[2].split(' - ')[1].split(' ')[1];
        let day = days.indexOf(entry.split(',')[0]);
        let time = timeToMinutes(entry.split(',')[1].split(' - ')[0])-480;
        let duration = courseDetails[inx].duration;
        let grade = courseDetails[inx].year;
        let department = courseDetails[inx].department;
        let course_name = courseDetails[inx].courseName;

        test.push(course_code + ',' + day + ',' + time + ',' + duration + ',' + classroom + ',' + grade + ',' + department + ',' + course_name);

    });

    optimizedSchedule.sort(                                                                 //this part it totaly for the output, nothing else
        (a, b) => {
            const nameA = a.split(',')[1].split(' - ')[0];
            const nameB = b.split(',')[1].split(' - ')[0];
            if (nameA < nameB)
                return -1;

            if (nameA > nameB)
                return 1;

            return 0;
        }
    )
    .sort(
        (a, b) => {
            const nameA = a.split(',')[2].split(' - ')[1];
            const nameB = b.split(',')[2].split(' - ')[1];
            if (nameA < nameB)
                return -1;

            if (nameA > nameB)
                return 1;

            return 0;
        }
    )
    .sort(
        (a, b) => {
            const nameA = a.split(',')[0];
            const nameB = b.split(',')[0];
            if (days.indexOf(nameA) < days.indexOf(nameB))
                return -1;

            if (days.indexOf(nameA) > days.indexOf(nameB))
                return 1;

            return 0;
        }
    )
    .forEach(entry => console.log(entry));

    // Write schedule to csv file
    const outputData = test.join('\n');
    fs.writeFileSync('Exam_Schedule.csv', outputData, 'utf-8');
})();

