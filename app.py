from flask import Flask, render_template, request, jsonify
import csv
import os
from datetime import datetime
import json
import sys

app = Flask(__name__)

# PyInstaller가 생성한 임시 폴더 경로를 가져오는 함수
def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

# 출결현황 폴더 경로 설정
ATTENDANCE_FOLDER = os.path.join(os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else os.path.dirname(os.path.abspath(__file__)), '출결현황')

# 폴더가 없으면 생성
if not os.path.exists(ATTENDANCE_FOLDER):
    os.makedirs(ATTENDANCE_FOLDER)

# CSV 파일 경로 설정 함수 수정
def get_csv_file_path():
    today = datetime.now().strftime('%Y-%m-%d')
    return os.path.join(ATTENDANCE_FOLDER, f'출결현황 {today}.csv')

# 전역 변수로 출결 상태 저장
attendance_in_progress = False

# 출석 정보를 CSV 파일에 저장
def save_to_csv(barcodes):
    csv_file = get_csv_file_path()
    save_date = datetime.now().strftime('%Y-%m-%d')
    with open(csv_file, mode='a', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        for barcode in barcodes:
            writer.writerow([
                save_date,
                barcode['code'],
                barcode['timestamp'],
                barcode['grade'],
                barcode['class'],
                barcode['number'],
                barcode['name']
            ])

# 학생 정보를 저장하고 불러오는 기능 추가
STUDENT_DATA_FILE = os.path.join(os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else os.path.dirname(os.path.abspath(__file__)), 'student_data.json')

def save_student_data(data):
    with open(STUDENT_DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_student_data():
    if os.path.exists(STUDENT_DATA_FILE):
        with open(STUDENT_DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

# 임시 출결 정보를 저장할 JSON 파일 경로
TEMP_ATTENDANCE_FILE = os.path.join(os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else os.path.dirname(os.path.abspath(__file__)), 'temp_attendance.json')

# 임시 출결 정보 저장 함수
def save_temp_attendance(data):
    with open(TEMP_ATTENDANCE_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# 임시 출결 정보 불러오기 함수
def load_temp_attendance():
    if os.path.exists(TEMP_ATTENDANCE_FILE):
        with open(TEMP_ATTENDANCE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

# 메인 페이지
@app.route('/')
def index():
    return render_template('index.html', attendance_in_progress=attendance_in_progress)

# 설정 페이지 추가
@app.route('/setting')
def setting():
    return render_template('setting.html')

# 스캔 데이터 저장 API
@app.route('/save', methods=['POST'])
def save_data():
    try:
        data = request.get_json()
        barcodes = data.get('barcodes', [])
        if barcodes:
            save_to_csv(barcodes)
            # 임시 파일 삭제
            if os.path.exists(TEMP_ATTENDANCE_FILE):
                os.remove(TEMP_ATTENDANCE_FILE)
            return jsonify({'status': 'success', 'message': 'Data saved successfully to CSV.'})
        else:
            return jsonify({'status': 'error', 'message': 'No data to save.'})
    except Exception as e:
        print(f"Error in save_data: {str(e)}")  # 콘솔에 오류 출력
        return jsonify({'status': 'error', 'message': f'An error occurred: {str(e)}'}), 500

# 임시 출결 정보 저장 API
@app.route('/save_temp', methods=['POST'])
def save_temp_data():
    data = request.get_json()
    save_temp_attendance(data)
    return jsonify({'status': 'success', 'message': 'Temporary data saved successfully.'})

# 임시 출결 정보 불러오기 API
@app.route('/load_temp', methods=['GET'])
def load_temp_data():
    data = load_temp_attendance()
    return jsonify(data)

# 출결 상태 조회 API
@app.route('/attendance_status', methods=['GET'])
def get_attendance_status():
    return jsonify({'attendance_in_progress': attendance_in_progress})

# 출결 종료 API
@app.route('/end_attendance', methods=['POST'])
def end_attendance():
    global attendance_in_progress
    attendance_in_progress = False
    return jsonify({'status': 'success', 'message': 'Attendance ended.', 'attendance_in_progress': attendance_in_progress})

# 출석 데이터 조회 API 수정
@app.route('/data', methods=['GET'])
def get_data():
    csv_file = get_csv_file_path()
    if os.path.exists(csv_file):
        with open(csv_file, mode='r', newline='', encoding='utf-8') as file:
            reader = csv.reader(file)
            data = [{'date': row[0], 'barcode': row[1], 'timestamp': row[2], 'grade': row[3], 'class': row[4], 'number': row[5], 'name': row[6]} for row in reader]
        return jsonify(data)
    else:
        return jsonify([])

# 학생 데이터 저장 API
@app.route('/save_student_data', methods=['POST'])
def save_student_data_route():
    data = request.get_json()
    save_student_data(data)
    return jsonify({'status': 'success', 'message': 'Student data saved successfully.'})

# 학생 데이터 불러오기 API
@app.route('/load_student_data', methods=['GET'])
def load_student_data_route():
    data = load_student_data()
    return jsonify(data)

# 학생 데이터 삭제 API
@app.route('/clear_student_data', methods=['POST'])
def clear_student_data():
    if os.path.exists(STUDENT_DATA_FILE):
        os.remove(STUDENT_DATA_FILE)
    return jsonify({'status': 'success', 'message': 'Student data cleared successfully.'})

# CSV 파일 경로를 반환하는 API
@app.route('/get_csv_path')
def get_csv_path():
    return jsonify({'path': get_csv_file_path()})

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False, host='0.0.0.0', port=5000)
