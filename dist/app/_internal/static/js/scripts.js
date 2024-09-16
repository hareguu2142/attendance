document.addEventListener('DOMContentLoaded', function () {
    const startBtn = document.getElementById('start-btn');
    const exitBtn = document.getElementById('exit-btn');
    const saveBtn = document.getElementById('save-btn');
    const statusSpan = document.getElementById('status');
    const dataList = document.getElementById('data-list');
    const uploadBtn = document.getElementById('upload-btn');
    const csvFile = document.getElementById('csv-file');
    const attendanceTable = document.getElementById('attendance-table');
    const lastScannedInfo = document.getElementById('last-scanned-info');
    const attendanceSummary = document.getElementById('attendance-summary');

    let isScanning = false;
    let buffer = '';
    let barcodes = []; // 기존 배열을 객체 배열로 변경
    let studentData = {};
    let attendanceCount = {};

    // 페이지 로드 시 학생 데이터 불러오기
    loadStudentData();

    function loadStudentData() {
        fetch('/load_student_data')
            .then(response => response.json())
            .then(data => {
                studentData = data;
                createTable();
                initializeAttendanceCount();
            })
            .catch(error => console.error('Error loading student data:', error));
    }

    function initializeAttendanceCount() {
        for (const grade in studentData) {
            attendanceCount[grade] = {};
            for (const classNum in studentData[grade]) {
                attendanceCount[grade][classNum] = {
                    total: Object.keys(studentData[grade][classNum]).length,
                    attended: 0
                };
            }
        }
        updateAttendanceSummary();
    }

    // 페이지 로드 시 임시 저장된 출결 정보 불러오기
    loadTempAttendance();

    function loadTempAttendance() {
        fetch('/load_temp')
            .then(response => response.json())
            .then(data => {
                barcodes = data;
                barcodes.forEach(item => {
                    if (item && item.code && item.timestamp && item.grade && item.class && item.number && item.name) {
                        displayData(item.code, item.timestamp, item.grade, item.class, item.number, item.name);
                        updateAttendance(item.code);
                    }
                });
            })
            .catch(error => console.error('Error loading temporary attendance data:', error));
    }

    // 스캔 모드 시작
    startBtn.addEventListener('click', function () {
        isScanning = true;
        statusSpan.textContent = '활성화';
        statusSpan.className = 'status-active';
    });

    // 스캔 모드 종료
    exitBtn.addEventListener('click', function () {
        isScanning = false;
        statusSpan.textContent = '비활성화';
        statusSpan.className = 'status-inactive';
    });

    // 바코드 스캔 시 임시 저장
    document.addEventListener('keydown', function (e) {
        if (!isScanning) return;

        if (e.key === 'Enter') {
            if (buffer.length > 0) {
                const timestamp = new Date().toLocaleString(); // 현재 시간 저장
                const studentInfo = findStudentByUniqueId(buffer);
                if (studentInfo) {
                    const { grade, className, studentNumber, name } = studentInfo;
                    const newAttendance = {
                        code: buffer,
                        timestamp: timestamp,
                        grade: grade,
                        class: className,
                        number: studentNumber,
                        name: name
                    };
                    barcodes.push(newAttendance);
                    displayData(buffer, timestamp, grade, className, studentNumber, name);
                    updateAttendance(buffer);
                    saveTempAttendance();
                } else {
                    console.error('Student not found for barcode:', buffer);
                }
                buffer = '';
            }
        } else {
            buffer += e.key;
        }
    });

    // 임시 출결 정보 저장
    function saveTempAttendance() {
        fetch('/save_temp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(barcodes)
        })
        .then(response => response.json())
        .then(data => console.log(data.message))
        .catch(error => console.error('Error saving temporary attendance data:', error));
    }

    // 저장 버튼 클릭 이벤트 수정
    saveBtn.addEventListener('click', function () {
        if (barcodes.length === 0) {
            alert('저장할 데이터가 없습니다.');
            return;
        }

        fetch('/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ barcodes: barcodes }) // 전체 barcodes 객체 배열을 전송
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                const today = new Date().toISOString().split('T')[0];
                alert(`${data.message}\n파일명: attendance_${today}.csv`);
                barcodes = [];
                dataList.innerHTML = '';
                // 출석 표시 초기화
                document.querySelectorAll('.attended').forEach(cell => {
                    cell.classList.remove('attended');
                });
                // 출석 요약 초기화
                initializeAttendanceCount();
                updateAttendanceSummary();
                // 임시 저장 데이터 삭제
                saveTempAttendance();
            } else {
                alert('저장에 실패했습니다.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('저장 중 오류가 발생했습니다.');
        });
    });

    // 스캔된 데이터를 화면에 표시
    function displayData(code, timestamp, grade, className, studentNumber, name) {
        if (code && timestamp && grade && className && studentNumber && name) {
            const li = document.createElement('li');
            li.textContent = `${code} - ${timestamp} - ${grade}학년 ${className}반 ${studentNumber}번 ${name}`;
            dataList.appendChild(li);
        } else {
            console.error('Invalid data for display:', { code, timestamp, grade, className, studentNumber, name });
        }
    }

    function updateAttendance(uniqueId) {
        const cell = attendanceTable.querySelector(`td[data-unique-id="${uniqueId}"]`);
        if (cell) {
            cell.classList.add('attended');

            // 마지막 스캔 정보 업데이트
            let studentInfo = findStudentByUniqueId(uniqueId);
            if (studentInfo) {
                const { grade, className, studentNumber, name } = studentInfo;
                lastScannedInfo.innerHTML = `
                    <h3>마지막 스캔</h3>
                    <p class="last-scanned-student">
                        ${grade}학년 ${className}반<br>
                        ${studentNumber}. ${name}
                    </p>`;

                // 출석 요약 업데이트
                if (!attendanceCount[grade][className].attended) {
                    attendanceCount[grade][className].attended = 0;
                }
                attendanceCount[grade][className].attended++;
                updateAttendanceSummary();
            }
        }
    }

    function findStudentByUniqueId(uniqueId) {
        for (const grade in studentData) {
            for (const className in studentData[grade]) {
                for (const studentNumber in studentData[grade][className]) {
                    const student = studentData[grade][className][studentNumber];
                    if (student.uniqueId === uniqueId) {
                        return {
                            grade,
                            className,
                            studentNumber,
                            name: student.name
                        };
                    }
                }
            }
        }
        return null;
    }

    function updateAttendanceSummary() {
        let summaryHTML = '<h3>출석 현황</h3><table class="attendance-summary-table">';
        summaryHTML += '<tr><th>학년</th><th>반</th><th>출석/전체</th></tr>';
        
        for (const grade in attendanceCount) {
            for (const className in attendanceCount[grade]) {
                const { total, attended } = attendanceCount[grade][className];
                summaryHTML += `<tr>
                    <td>${grade}학년</td>
                    <td>${className}반</td>
                    <td>${attended}/${total}</td>
                </tr>`;
            }
        }
        
        summaryHTML += '</table>';
        attendanceSummary.innerHTML = summaryHTML;
    }

    // 업로드 버튼 클릭 이벤트
    uploadBtn.addEventListener('click', function() {
        csvFile.click();
    });

    // CSV 파일 선택 이벤트
    csvFile.addEventListener('change', function(e) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            const decoder = new TextDecoder('euc-kr');
            const decodedContent = decoder.decode(new Uint8Array(content));
            processCSV(decodedContent);
            // 학생 데이터를 서버에 저장
            saveStudentData();
        };
        reader.readAsArrayBuffer(file);
    });

    function saveStudentData() {
        fetch('/save_student_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(studentData)
        })
        .then(response => response.json())
        .then(data => {
            console.log(data.message);
            loadStudentData(); // 저장 후 다시 불러오기
        })
        .catch(error => console.error('Error saving student data:', error));
    }

    // CSV 데이터 처리 함수
    function processCSV(content) {
        const lines = content.split('\n');
        const headers = lines[0].split(',');
        
        for (let i = 1; i < lines.length; i++) {
            const data = lines[i].split(',');
            if (data.length === headers.length) {
                const [grade, classNum, studentNum, name, uniqueId] = data.map(item => item.trim());
                if (!studentData[grade]) studentData[grade] = {};
                if (!studentData[grade][classNum]) studentData[grade][classNum] = {};
                studentData[grade][classNum][studentNum] = {name, uniqueId};
            }
        }
        
        createTable();
    }

    // 표 생성 함수
    function createTable() {
        let tableHTML = '<tr>';
        const grades = Object.keys(studentData).sort();
        
        // 학년 헤더
        grades.forEach(grade => {
            const classCount = Object.keys(studentData[grade]).length;
            tableHTML += `<th colspan="${classCount}">${grade}학년</th>`;
        });
        tableHTML += '</tr>';

        // 반 번호 행
        tableHTML += '<tr>';
        grades.forEach((grade, gradeIndex) => {
            const classes = Object.keys(studentData[grade]).sort((a, b) => Number(a) - Number(b));
            classes.forEach((classNum, index) => {
                const isFirstClass = index === 0;
                tableHTML += `<th class="class-header class-color-${index % 5}${isFirstClass ? ' grade-start' : ''}">${classNum}반</th>`;
            });
        });
        tableHTML += '</tr>';

        // 학생 데이터 행
        const maxStudent = Math.max(...grades.flatMap(grade => 
            Object.values(studentData[grade]).flatMap(classObj => Object.keys(classObj).map(Number))
        ));

        for (let studentNum = 1; studentNum <= maxStudent; studentNum++) {
            tableHTML += '<tr>';
            grades.forEach((grade, gradeIndex) => {
                const classes = Object.keys(studentData[grade]).sort((a, b) => Number(a) - Number(b));
                classes.forEach((classNum, index) => {
                    const student = studentData[grade][classNum] && studentData[grade][classNum][studentNum];
                    const isFirstClass = index === 0;
                    tableHTML += `<td class="class-color-${index % 5}${isFirstClass ? ' grade-start' : ''} grade-${grade}-${classNum}" data-unique-id="${student ? student.uniqueId : ''}">
                        ${student ? `<span class="student-number">${studentNum}.</span> ${student.name}` : ''}
                    </td>`;
                });
            });
            tableHTML += '</tr>';
        }

        attendanceTable.innerHTML = tableHTML;
    }

    // 초기 테이블 생성
    if (Object.keys(studentData).length > 0) {
        createTable();
    }
});

// CSV 파일 저장 경로를 서버에서 받아오도록 수정
function saveCsvFile() {
    fetch('/get_csv_path')
        .then(response => response.json())
        .then(data => {
            // data.path를 사용하여 CSV 파일 저장
        })
        .catch(error => console.error('Error:', error));
}
