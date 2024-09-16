document.addEventListener('DOMContentLoaded', function () {
    const studentInfoDiv = document.getElementById('student-info');
    const clearDataBtn = document.getElementById('clear-data');

    // 페이지 로드 시 학생 정보 표시
    displayStudentInfo();

    function displayStudentInfo() {
        fetch('/load_student_data')
            .then(response => response.json())
            .then(studentData => {
                let html = '<h2>현재 저장된 학생 정보</h2>';

                if (Object.keys(studentData).length === 0) {
                    html += '<p>저장된 학생 정보가 없습니다.</p>';
                } else {
                    html += '<ul>';
                    for (const grade in studentData) {
                        for (const classNum in studentData[grade]) {
                            for (const studentNum in studentData[grade][classNum]) {
                                const student = studentData[grade][classNum][studentNum];
                                html += `<li>${grade}학년 ${classNum}반 ${studentNum}번 ${student.name} (ID: ${student.uniqueId})</li>`;
                            }
                        }
                    }
                    html += '</ul>';
                }

                studentInfoDiv.innerHTML = html;
            })
            .catch(error => console.error('Error loading student data:', error));
    }

    clearDataBtn.addEventListener('click', function() {
        if (confirm('모든 학생 정보를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            fetch('/clear_student_data', { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    console.log(data.message);
                    displayStudentInfo(); // 삭제 후 다시 정보 표시
                })
                .catch(error => console.error('Error clearing student data:', error));
        }
    });

    displayStudentInfo();
});