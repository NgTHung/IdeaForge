# Tầm nhìn sản phẩm IdeaForge

> IdeaForge là canvas cộng tác giúp nhóm biến các ý tưởng rời rạc thành một bản đồ lập luận và quyết định: ý tưởng nào hỗ trợ hoặc mâu thuẫn với nhau, điều gì đã có bằng chứng, điều gì vẫn là giả định, và nhóm nên kiểm tra điều gì tiếp theo.

Tài liệu này diễn giải nội dung nhìn thấy trong ảnh tham khảo thành định hướng sản phẩm cho IdeaForge. Ảnh bị cắt ở phần cuối; nội dung dưới đây dựa trên các đoạn đọc được.

## 1. Vấn đề cần giải quyết

### Các công cụ tương tự đang giải quyết phần nào?

IdeaForge bước vào một không gian đã có các bảng cộng tác trực quan mạnh. Theo tài liệu sản phẩm hiện tại:

| Sản phẩm | Khả năng liên quan | Điều này gợi ý cho IdeaForge |
| --- | --- | --- |
| **Miro AI** | Tạo ghi chú, gom nhóm theo từ khóa hoặc cảm xúc, tóm tắt ghi chú đã chọn và tạo tài liệu từ nội dung trên board. | Việc tạo ý tưởng, tìm chủ đề chung và tóm tắt đã là năng lực phổ biến. |
| **FigJam AI** | Sắp xếp ghi chú theo chủ đề và tóm tắt nhiều ghi chú; tài liệu Figma lưu ý kết quả cần được người dùng xem lại và tinh chỉnh. | AI có thể giảm công sức sắp xếp, nhưng nhóm vẫn cần diễn giải kết quả. |
| **Mural AI** | Tạo mind map, gom ghi chú theo chủ đề, phân loại cảm xúc, tóm tắt và hội thoại để tạo ý tưởng/câu hỏi/giả thuyết. | Chỉ thêm AI sinh ý tưởng hoặc gom nhóm sẽ khó tạo khác biệt rõ ràng. |

Nguồn: [Miro AI với sticky notes](https://help.miro.com/hc/en-us/articles/28781881506834-Miro-AI-with-Sticky-notes), [FigJam AI: sắp xếp và tóm tắt sticky notes](https://help.figma.com/hc/en-us/articles/18711926790423-Sort-and-summarize-stickies-with-FigJam-AI), [Mural AI](https://www.mural.co/mural-ai). Các mô tả này phản ánh tính năng được tài liệu chính thức nêu; chúng không chứng minh rằng những sản phẩm đó không thể hỗ trợ các quy trình khác.

### Pain point còn lại và cơ hội cho IdeaForge

1. **Gom cùng chủ đề chưa giải thích được quan hệ lập luận.** Hai thẻ có thể cùng nói về học tập nhưng một thẻ có thể hỗ trợ, phụ thuộc, mâu thuẫn hoặc trả lời thẻ kia. Nhóm cần thấy loại quan hệ và lý do nối, không chỉ thấy chúng nằm chung một cụm.
2. **Tóm tắt chưa tự trả lời “giờ cần quyết định gì?”.** Sau khi xem các ý tưởng, nhóm vẫn cần xác định nhận định nào có bằng chứng, giả định nào quan trọng nhưng chưa được kiểm chứng, mâu thuẫn nào cần giải quyết và thử nghiệm nào nên làm tiếp.
3. **Brainstorm trực tiếp có thể làm một số ý tưởng bị chậm hoặc không được nói ra.** Nghiên cứu thực nghiệm về production blocking cho thấy việc phải chờ lượt có thể làm gián đoạn quá trình tạo ý tưởng và giảm tính linh hoạt. Canvas hỗ trợ nhập ý tưởng đồng thời; một hướng phát triển sau đó là cho thành viên viết riêng trước khi cùng xem để giảm ảnh hưởng của người nói trước. [Nijstad, Stroebe & Lodewijkx (2003)](https://doi.org/10.1016/S0022-1031(03)00040-4).
4. **AI có thể giúp từng người nhưng khiến các kết quả giống nhau hơn.** Trong một thí nghiệm viết truyện ngắn, gợi ý AI cải thiện đánh giá từng câu chuyện, nhưng các câu chuyện có AI hỗ trợ giống nhau hơn. Vì vậy, IdeaForge nên giữ nguyên đóng góp của thành viên, thể hiện nguồn của mỗi phần, đưa ra lựa chọn để nhóm so sánh và yêu cầu con người xác nhận gợi ý. Kết quả này đến từ tác vụ viết truyện, nên cần được xem là cảnh báo thiết kế chứ không phải kết luận trực tiếp về mọi phiên brainstorm. [Doshi & Hauser, Science Advances (2024)](https://doi.org/10.1126/sciadv.adn5290).
5. **Nhóm cần lần lại con đường từ ý tưởng đến concept cuối.** Khi quay lại board hoặc trình bày dự án, họ cần biết concept nào xuất phát từ ghi chú nào, dựa trên bằng chứng gì và còn giả định nào chưa được giải quyết.

### Khoảng trống IdeaForge sẽ nhắm tới

IdeaForge sẽ giúp nhóm chuyển từ **các ghi chú và cụm chủ đề** sang **bản đồ quan hệ và quyết định có thể kiểm tra**. Mỗi liên kết giải thích một quan hệ; mỗi nhận định có thể được đánh dấu là bằng chứng, giả định hoặc câu hỏi mở; mỗi concept giữ dấu vết về nguồn; AI đề xuất các kết nối và câu hỏi để nhóm chấp nhận, sửa hoặc bỏ.

Đây là giả thuyết định vị cần kiểm chứng với sinh viên: liệu bản đồ quan hệ có giúp họ hiểu vì sao một concept hợp lý và thống nhất bước tiếp theo nhanh hơn so với chỉ gom hoặc tóm tắt ghi chú?

## 2. Người dùng và giá trị

**Người dùng chính:** nhóm sinh viên hoặc nhóm hackathon cùng phát triển một dự án.

**Giá trị cốt lõi:** cả nhóm có thể xem một bản đồ chung thể hiện mối quan hệ giữa ý tưởng, bằng chứng, giả định, bất đồng và quyết định. AI đề xuất kết nối hoặc câu hỏi cần xem xét; thành viên trong nhóm xác nhận, chỉnh sửa hoặc bỏ đề xuất.

## 3. Luồng sử dụng

1. **Đặt mục tiêu:** nhóm ghi vấn đề hoặc mục tiêu đang cần giải quyết.
2. **Thêm thẻ:** thành viên đưa ý tưởng, bằng chứng, giả định, câu hỏi hoặc quyết định lên canvas.
3. **Nối các thẻ:** người dùng chọn loại quan hệ, chẳng hạn:
   - **Hỗ trợ:** thẻ này củng cố thẻ kia.
   - **Phụ thuộc:** thẻ này chỉ đúng nếu điều kia đúng.
   - **Mâu thuẫn:** hai thẻ đưa ra nhận định hoặc hướng giải khác nhau.
   - **Trả lời:** bằng chứng hoặc kết quả giải đáp một câu hỏi.
4. **Đánh dấu mức độ chắc chắn:** phân biệt điều đã có bằng chứng, giả định cần kiểm tra và câu hỏi còn bỏ ngỏ.
5. **Nhận gợi ý từ AI:** AI đề xuất liên kết còn thiếu hoặc đặt câu hỏi cụ thể về giả định chưa được hỗ trợ. Người dùng quyết định có thêm gợi ý đó vào bản đồ không.
6. **Xem bản đồ quyết định:** IdeaForge làm nổi bật giả định thiếu bằng chứng, ý tưởng mâu thuẫn và câu hỏi tiếp theo cần giải quyết.
7. **Theo dõi quá trình phát triển:** nhóm thấy concept cuối cùng bắt nguồn từ thẻ, bằng chứng và quyết định nào, rồi tạo thử nghiệm tiếp theo.

## 4. Sản phẩm nên gồm những gì

### Canvas cộng tác

- Thẻ có thể thêm, sửa, di chuyển và chọn.
- Thành viên cộng tác trên cùng một board.
- Mỗi thẻ có loại nội dung: ý tưởng, bằng chứng, giả định, câu hỏi hoặc quyết định.
- Các đường nối có nhãn quan hệ để giải thích lập luận, thay vì chỉ biểu thị rằng hai thẻ có liên quan.

### AI hỗ trợ suy nghĩ

- Đề xuất một kết nối tiềm năng giữa hai thẻ và giải thích cơ sở của đề xuất.
- Nhận diện giả định chưa có bằng chứng hỗ trợ.
- Đặt một câu hỏi cụ thể như: “Giả định nào cần đúng để kết luận này hợp lý?”
- Đề xuất bước kiểm chứng nhỏ, có đối tượng, hành động và dấu hiệu quan sát được.
- Đánh dấu rõ đây là gợi ý để nhóm đánh giá, không phải dữ kiện đã xác minh.

### Bản đồ quyết định

Một phần tổng hợp từ các thẻ và liên kết hiện có, gồm:

- Các ý tưởng trung tâm và những ý tưởng hỗ trợ chúng.
- Mâu thuẫn hoặc phụ thuộc chưa được giải quyết.
- Giả định có ảnh hưởng lớn nhưng thiếu bằng chứng.
- Câu hỏi hoặc thử nghiệm ưu tiên tiếp theo.
- Nguồn gốc của concept được chọn.

## 5. MVP thực tế cho hackathon

Để giữ phạm vi gọn, phiên bản đầu tiên nên tập trung vào một vòng làm việc hoàn chỉnh:

1. Tạo và chỉnh sửa thẻ trên canvas.
2. Nối hai thẻ bằng nhãn quan hệ: hỗ trợ, phụ thuộc, mâu thuẫn hoặc trả lời.
3. Đánh dấu thẻ là bằng chứng, giả định hoặc câu hỏi mở.
4. Yêu cầu AI gợi ý một liên kết hoặc câu hỏi dựa trên các thẻ được chọn.
5. Cho phép thành viên chấp nhận, chỉnh sửa hoặc bỏ gợi ý.
6. Tạo bảng “Cần giải quyết tiếp” liệt kê mâu thuẫn, giả định thiếu bằng chứng và câu hỏi ưu tiên.
7. Giữ liên kết nguồn để nhóm truy lại quá trình hình thành concept.

Có thể tận dụng luồng merge hai ghi chú hiện tại làm một hành động trong canvas. Khi ghép ý tưởng, kết quả nên trở thành thẻ con có giải thích phần đóng góp từ từng nguồn và quan hệ giữa chúng. Sau đó nhóm có thể gắn bằng chứng hoặc giả định vào concept này.

### Để sau MVP

- Chế độ thành viên viết ý tưởng riêng trước khi cùng mở ra.
- Phân tích chủ đề tự động trên toàn bộ board.
- Tìm kiếm bằng chứng trên web.
- Tự động chấm điểm độ mới hoặc chất lượng quyết định.
- Quy trình nhiều agent hoặc nhiều lượt gọi AI.

## 6. Nguyên tắc thiết kế

- **Giải thích quan hệ:** mỗi đường nối cần trả lời “vì sao hai thẻ liên quan?”
- **Giữ dấu vết:** không làm mất thẻ gốc khi concept được tạo hoặc chỉnh sửa.
- **Thể hiện điều chưa chắc chắn:** phân biệt bằng chứng với giả định và câu hỏi mở.
- **Để con người quyết định:** mọi liên kết hoặc câu hỏi do AI tạo đều có thể chấp nhận, sửa hoặc bỏ.
- **Tập trung vào bước tiếp theo:** gợi ý AI cần giúp nhóm biết nên hỏi ai, kiểm tra điều gì hoặc làm thử nghiệm nào.
- **Không phóng đại:** AI không thể tự xác nhận một ý tưởng là mới, khả thi hoặc đã có nhu cầu thật.

## 7. Cách đánh giá bản demo

Một phiên dùng thử tốt là khi hai thành viên có thể:

- Đưa các ý tưởng của mình lên cùng một canvas.
- Giải thích được ít nhất một liên kết giữa các thẻ.
- Phân biệt điều nhóm biết với điều nhóm đang giả định.
- Chọn được một câu hỏi hoặc thử nghiệm tiếp theo.
- Truy lại được các nguồn đã tạo nên concept cuối.

Trong thử nghiệm nhỏ, ghi lại nơi người dùng bối rối, gợi ý AI nào họ chấp nhận hoặc loại bỏ, và liệu bản đồ có giúp họ thống nhất bước tiếp theo hay không. Chỉ báo cáo quan sát thực tế; không kết luận rằng sản phẩm đã chứng minh độ mới hay hiệu quả của ý tưởng.

## Tóm tắt

IdeaForge nên phát triển thành **bản đồ suy nghĩ và quyết định có AI hỗ trợ**. Canvas là nơi nhóm cùng làm việc; giá trị chính nằm ở các quan hệ có giải thích, dấu vết nguồn, trạng thái bằng chứng/giả định và câu hỏi hành động tiếp theo. AI gợi ý cách kết nối và điều cần kiểm chứng, còn nhóm giữ quyền xác nhận và quyết định.
