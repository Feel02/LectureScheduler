# LectureScheduler

It's an lecture scheduler project for using in our university. 
        
To run:

    node main.js
      
Fall_Courses.csv:
      
      Section;Course_Code;Course_Name;Number_of_Students;Course_Environment;T+U;AKTS ;Class;Depertmant;Lecturer;Department
      1;CE101;INTRODUCTION TO CIVIL ENGINEERING;100;classroom;2+0;2;1;İNŞAAT MÜH.(İNG);Dr. Öğr. Üyesi ****** ********;CE

Classroom_Capacities.csv:
      
      floor_number;classroom_id;capacity;available_days
      -4;DB412;176;Monday-Tuesday

BusyLecturer.csv:

        LecturerName,BusyDay
        Öğr.Gör. ****** ********,Monday

SpecifiedLecture.csv:

        Department;Course_Code;Day;Starting_Time
        BİLGİSAYAR MÜH.;CENG204;Tuesday;08:30

mandatory.csv:

        Course_Code
        ENG101
        MATH101
        CENG113
        CHEM101

split.csv:

        Department;Course_Code;Half_Duration
        MATEMATİK;MATH111;1
        BİLGİSAYAR MÜH.;MATH102;1

conflict.csv:

        Department1;Course_Code1;Department2;Course_Code2
        BİLGİSAYAR MÜH.;CENG415;BİLGİSAYAR MÜH.;CENG462
        BİLGİSAYAR MÜH.;CENG415;BİLGİSAYAR MÜH.;CENG442

After running the program you can see the output from the console or use the link for visualizing schedule.

https://feel02.github.io/UiTrialsForLectureScheduler/home.html
